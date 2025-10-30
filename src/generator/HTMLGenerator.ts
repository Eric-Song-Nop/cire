import * as fs from "node:fs";
import * as path from "node:path";
import * as commentParser from "comment-parser";
import { marked } from "marked";
import { match } from "ts-pattern";
import type { DocGenerator, FileIR, Position, TokenInfo } from "../types";

/**
 * We turn the source code with Highlight Info into HTML
 * Only syntax highlighting is considered - hover and definition are ignored for now
 */
class HTMLGenerator implements DocGenerator {
	/**
	 * Convert position to character offset in source text
	 */
	private positionToOffset(text: string, pos: Position): number {
		const lines = text.split("\n");
		let offset = 0;

		for (let i = 0; i < pos.line; i++) {
			offset += lines[i].length + 1; // +1 for newline
		}

		return offset + pos.column;
	}

	/**
	 * Sort tokens by start position to ensure correct processing order
	 */
	private sortTokens(tokens: TokenInfo[]): TokenInfo[] {
		return tokens.sort((a, b) => {
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}
			return a.span.start.column - b.span.start.column;
		});
	}

	/**
	 * Escape HTML special characters to prevent rendering issues
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Extract token information including classes and hover data
	 */
	private extractTokenInfo(meta: TokenInfo["meta"]): {
		classes: string[];
		hoverContent?: string;
		hoverDocumentation?: string;
	} {
		const classes: string[] = [];
		let hoverContent: string | undefined;
		let hoverDocumentation: string | undefined;

		meta.forEach((m) => {
			match(m)
				.with({ type: "highlight" }, (mh) => {
					classes.push(...mh.highlightClasses);
				})
				.with({ type: "hover" }, (mh) => {
					classes.push("token-hoverable");
					hoverContent = mh.content;
					// Preprocess hover documentation with marked on server-side
					if (mh.documentation) {
						try {
							hoverDocumentation = marked.parse(mh.documentation);
						} catch (error) {
							console.warn(error);
							// Fallback to escaped documentation if marked fails
							hoverDocumentation = this.escapeHtml(
								mh.documentation,
							);
						}
					}
				})
				.with({ type: "definition" }, () => {})
				.with({ type: "comment" }, () => {})
				.exhaustive();
		});

		return {
			classes,
			hoverContent,
			hoverDocumentation,
		};
	}

	/**
	 * Generate HTML from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			// Read source file content
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			// Calculate relative path from output file back to output root (where CSS is)
			const outputFileDir = path.dirname(fileIR.relativePath);
			const cssPath =
				path.relative(outputFileDir, "default.css") || "./default.css";
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

			// Check if we have comment tokens - if not, use original method
			const hasCommentTokens = info.some((token) =>
				token.meta.some((m) => m.type === "comment"),
			);

			if (!hasCommentTokens) {
				// Original method for backward compatibility
				const sortedTokens = this.sortTokens(info);
				const htmlContent = this.generateHighlightedHTML(
					sourceContent,
					sortedTokens,
				);
				return this.wrapInHTMLTemplate(fileIR, htmlContent, cssPath);
			}

			// New Markdown-style rendering approach
			const htmlContent = this.generateMarkdownHTML(
				fileIR,
				sourceContent,
				info,
			);
			return this.wrapInHTMLTemplate(fileIR, htmlContent, cssPath);
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * Render comment token to HTML with comment-parser integration
	 */
	private renderCommentToken(commentText: string): string {
		// comment-parser will handle comment markers automatically
		const parsed = commentParser.parse(commentText);

		if (parsed.length > 0 && parsed[0].tags.length > 0) {
			// Has JSDoc tags, render as JSDoc
			return this.renderJSDocComment(parsed[0]);
		}

		// Rebuild description with proper newlines from source lines
		if (parsed.length > 0) {
			const sourceLines = parsed[0].source;
			const descriptions = sourceLines
				.map((line) => line.tokens.description)
				.filter((desc) => desc !== undefined);
			const rebuiltDescription = descriptions.join("\n");

			const renderedContent = marked.parse(rebuiltDescription);
			return `<div class="token-comment">${renderedContent}</div>`;
		}

		// Should not happen, but handle empty parsed result
		const renderedContent = marked.parse(commentText);
		return `<div class="token-comment">${renderedContent}</div>`;
	}

	/**
	 * Render JSDoc comment using parsed comment-parser result
	 */
	private renderJSDocComment(jsdoc: commentParser.Block): string {
		let html = "";

		// Render main description using marked
		if (jsdoc.description) {
			html += `<div class="jsdoc-description">${marked.parseInline(jsdoc.description)}</div>`;
		}

		// Render tags
		html += '<div class="jsdoc-tags">';
		for (const tag of jsdoc.tags) {
			html += this.renderJSDocTag(tag);
		}
		html += "</div>";

		return `<span class="token-comment jsdoc-comment">${html}</span>`;
	}

	/**
	 * Render individual JSDoc tag
	 */
	private renderJSDocTag(tag: commentParser.Spec): string {
		const tagName = tag.tag || "";
		const name = tag.name || "";
		const description = tag.description || "";

		let tagContent = `<span class="jsdoc-tag-name">@${tagName}</span>`;

		if (name) {
			tagContent += ` <span class="jsdoc-tag-name">${this.escapeHtml(name)}</span>`;
		}

		if (description) {
			tagContent += ` <span class="jsdoc-tag-description">${marked.parseInline(description)}</span>`;
		}

		return `<div class="jsdoc-tag">${tagContent}</div>`;
	}

	/**
	 * Generate Markdown-style HTML separating comments and code with syntax highlighting
	 */
	private generateMarkdownHTML(
		fileIR: FileIR,
		sourceContent: string,
		info: TokenInfo[],
	): string {
		const lines = sourceContent.split("\n");

		// Extract comment tokens and sort by position
		const commentTokens = info
			.filter((token) => token.meta.some((m) => m.type === "comment"))
			.sort((a, b) => {
				if (a.span.start.line !== b.span.start.line) {
					return a.span.start.line - b.span.start.line;
				}
				return a.span.start.column - b.span.start.column;
			});

		// Get non-comment tokens for syntax highlighting
		const nonCommentTokens = info
			.filter((token) => !token.meta.some((m) => m.type === "comment"))
			.sort((a, b) => {
				if (a.span.start.line !== b.span.start.line) {
					return a.span.start.line - b.span.start.line;
				}
				return a.span.start.column - b.span.start.column;
			});

		const result: string[] = [];
		let currentLine = 0;

		// Process each comment token and the code between them
		for (const commentToken of commentTokens) {
			const startLine = commentToken.span.start.line;
			const endLine = commentToken.span.end.line;

			// Add highlighted code before this comment (if any)
			if (currentLine < startLine) {
				const highlightedCode = this.generateHighlightedCodeSegment(
					sourceContent,
					currentLine,
					startLine - 1,
					nonCommentTokens,
				);
				if (highlightedCode.trim()) {
					result.push(
						`<pre><code class="language-ts">${highlightedCode}</code></pre>`,
					);
				}
			}

			// Add the comment as markdown content
			const commentLines = lines.slice(startLine, endLine + 1);
			const commentText = commentLines.join("\n");
			const renderedComment = this.renderCommentToken(commentText);
			result.push(renderedComment);

			currentLine = endLine + 1;
		}

		// Add remaining highlighted code after the last comment
		if (currentLine < lines.length) {
			const highlightedCode = this.generateHighlightedCodeSegment(
				sourceContent,
				currentLine,
				lines.length - 1,
				nonCommentTokens,
			);
			if (highlightedCode.trim()) {
				result.push(
					`<pre><code class="language-ts">${highlightedCode}</code></pre>`,
				);
			}
		}

		const markdownContent = result.join("\n");
		return `<div class="markdown-content">${markdownContent}</div>`;
	}

	/**
	 * Generate highlighted HTML for a specific line range
	 */
	private generateHighlightedCodeSegment(
		sourceContent: string,
		startLine: number,
		endLine: number,
		tokens: TokenInfo[],
	): string {
		if (startLine > endLine) return "";

		const lines = sourceContent.split("\n");
		let result = "";
		// Filter tokens that are within our line range
		const rangeTokens = tokens.filter((token) => {
			const tokenStart = token.span.start.line;
			const tokenEnd = token.span.end.line;
			return tokenStart <= endLine && tokenEnd >= startLine;
		});

		// Process each line in the range
		for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
			if (lineNum >= lines.length) break;

			const line = lines[lineNum];
			const lineStartOffset = this.positionToOffset(sourceContent, {
				line: lineNum,
				column: 0,
			});
			const lineEndOffset = this.positionToOffset(sourceContent, {
				line: lineNum,
				column: line.length,
			});

			// Find tokens that overlap with this line
			const lineTokens = rangeTokens.filter((token) => {
				const tokenStart = this.positionToOffset(
					sourceContent,
					token.span.start,
				);
				const tokenEnd = this.positionToOffset(
					sourceContent,
					token.span.end,
				);
				return tokenStart < lineEndOffset && tokenEnd > lineStartOffset;
			});

			if (lineTokens.length === 0) {
				// No tokens for this line, just add the escaped line
				result += this.escapeHtml(line) + "\n";
			} else {
				// Process tokens on this line
				const lineContent = this.processTokensOnLine(
					sourceContent,
					lineNum,
					lineTokens,
				);
				result += lineContent + "\n";
			}
		}

		return result.trim();
	}

	/**
	 * Process tokens on a specific line
	 */
	private processTokensOnLine(
		sourceContent: string,
		lineNum: number,
		lineTokens: TokenInfo[],
	): string {
		const lines = sourceContent.split("\n");
		const line = lines[lineNum];
		const lineStartOffset = this.positionToOffset(sourceContent, {
			line: lineNum,
			column: 0,
		});
		const lineEndOffset = this.positionToOffset(sourceContent, {
			line: lineNum,
			column: line.length,
		});

		// Sort tokens by position
		lineTokens.sort((a, b) => {
			const startA = this.positionToOffset(sourceContent, a.span.start);
			const startB = this.positionToOffset(sourceContent, b.span.start);
			return startA - startB;
		});

		let result = "";
		let currentOffset = lineStartOffset;

		// Process each token
		for (const token of lineTokens) {
			const tokenStart = this.positionToOffset(
				sourceContent,
				token.span.start,
			);
			const tokenEnd = this.positionToOffset(
				sourceContent,
				token.span.end,
			);

			// Add text before token
			if (tokenStart > currentOffset) {
				const textBefore = sourceContent.slice(
					currentOffset,
					tokenStart,
				);
				result += this.escapeHtml(textBefore);
			}

			// Add token with styling
			const tokenText = sourceContent.slice(tokenStart, tokenEnd);
			const tokenInfo = this.extractTokenInfo(token.meta);

			if (tokenInfo.classes.length > 0 || tokenInfo.hoverContent) {
				const classAttr =
					tokenInfo.classes.length > 0
						? ` class="${tokenInfo.classes.join(" ")}"`
						: "";
				let dataAttrs = "";
				if (tokenInfo.hoverContent) {
					dataAttrs += ` data-hover-content="${this.escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						dataAttrs += ` data-hover-documentation="${this.escapeHtml(tokenInfo.hoverDocumentation)}"`;
					}
				}
				result += `<span${classAttr}${dataAttrs}>${this.escapeHtml(tokenText)}</span>`;
			} else {
				result += this.escapeHtml(tokenText);
			}

			currentOffset = tokenEnd;
		}

		// Add remaining text after last token
		if (currentOffset < lineEndOffset) {
			const textAfter = sourceContent.slice(currentOffset, lineEndOffset);
			result += this.escapeHtml(textAfter);
		}

		return result;
	}

	/**
	 * Generate HTML with highlighted tokens, preserving all source text
	 */
	private generateHighlightedHTML(
		sourceContent: string,
		tokens: TokenInfo[],
	): string {
		if (tokens.length === 0) {
			// No highlight tokens, just escape and wrap in pre/code
			return `<pre><code>${this.escapeHtml(sourceContent)}</code></pre>`;
		}

		let result = "";
		let currentOffset = 0;

		// Process tokens in order
		for (const token of tokens) {
			const tokenStart = this.positionToOffset(
				sourceContent,
				token.span.start,
			);
			const tokenEnd = this.positionToOffset(
				sourceContent,
				token.span.end,
			);

			// Add text before token (unhighlighted but preserved)
			if (tokenStart > currentOffset) {
				const textBefore = sourceContent.slice(
					currentOffset,
					tokenStart,
				);
				result += this.escapeHtml(textBefore);
			}

			// Add token with CSS classes and hover data
			const tokenText = sourceContent.slice(tokenStart, tokenEnd);
			const tokenInfo = this.extractTokenInfo(token.meta);

			if (tokenInfo.classes.length > 0 || tokenInfo.hoverContent) {
				const classAttr =
					tokenInfo.classes.length > 0
						? ` class="${tokenInfo.classes.join(" ")}"`
						: "";

				let dataAttrs = "";
				if (tokenInfo.hoverContent) {
					dataAttrs += ` data-hover-content="${this.escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						dataAttrs += ` data-hover-documentation="${this.escapeHtml(tokenInfo.hoverDocumentation)}"`;
					}
				}

				result += `<span${classAttr}${dataAttrs}>${this.escapeHtml(tokenText)}</span>`;
			} else {
				// No classes or hover info, just escape the text
				result += this.escapeHtml(tokenText);
			}

			currentOffset = tokenEnd;
		}

		// Add remaining text after last token
		if (currentOffset < sourceContent.length) {
			const remainingText = sourceContent.slice(currentOffset);
			result += this.escapeHtml(remainingText);
		}

		return `<pre><code>${result}</code></pre>`;
	}

	/**
	 * Wrap content in HTML template with hover support
	 */
	private wrapInHTMLTemplate(
		fileIR: FileIR,
		content: string,
		cssPath: string,
	): string {
		const fileName = path.basename(fileIR.relativePath);
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName} - Cire Documentation</title>
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <div class="container">
        ${content}
    </div>

    <div class="hover-tooltip" id="tooltip">
        <div class="symbol-name" id="tooltip-symbol"></div>
        <div class="documentation" id="tooltip-docs"></div>
    </div>

    <script>
        const tooltip = document.getElementById('tooltip');
        const tooltipSymbol = document.getElementById('tooltip-symbol');
        const tooltipDocs = document.getElementById('tooltip-docs');
        let hideTimeout;

        function parseMarkdown(text) {
            if (!text) return '';
            // Markdown is now preprocessed on server-side using marked
            // Just return the pre-rendered HTML directly
            return text;
        }

        function showTooltip(element, content, documentation) {
            clearTimeout(hideTimeout);

            tooltipSymbol.textContent = content;
            tooltipDocs.innerHTML = parseMarkdown(documentation || '');

            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 10;

            // Keep tooltip within viewport
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }
            if (top < 10) {
                top = rect.bottom + 10;
            }

            tooltip.style.left = left + window.scrollX + 'px';
            tooltip.style.top = top + window.scrollY + 'px';

            tooltip.classList.add('visible');
        }

        function hideTooltip() {
            hideTimeout = setTimeout(() => {
                tooltip.classList.remove('visible');
            }, 100);
        }

        // Add hover listeners to all hoverable tokens
        document.addEventListener('DOMContentLoaded', () => {
            const hoverableElements = document.querySelectorAll('[data-hover-content]');

            hoverableElements.forEach(element => {
                const content = element.getAttribute('data-hover-content');
                const documentation = element.getAttribute('data-hover-documentation');

                element.addEventListener('mouseenter', (e) => {
                    showTooltip(e.target, content, documentation);
                });

                element.addEventListener('mouseleave', hideTooltip);
            });

            // Hide tooltip when clicking elsewhere
            document.addEventListener('click', hideTooltip);
        });
    </script>
</body>
</html>`;
	}
}

export { HTMLGenerator };
export default HTMLGenerator;
