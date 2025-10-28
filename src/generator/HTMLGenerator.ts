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
	generate(fileIR: FileIR, info: TokenInfo[]): string {
		try {
			// Read source file content
			const sourcePath = path.resolve(fileIR.filePath);
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
				return this.wrapInHTMLTemplate(fileIR, htmlContent);
			}

			// New segmented rendering approach
			const htmlContent = this.generateSegmentedHTML(fileIR, info);
			return this.wrapInHTMLTemplate(fileIR, htmlContent);
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.filePath}: ${error}`,
			);
		}
	}

	/**
	 * Render comment token to HTML with comment-parser integration
	 */
	private renderCommentToken(commentText: string): string {
		try {
			// comment-parser will handle comment markers automatically
			const parsed = commentParser.parse(commentText);

			if (parsed.length > 0 && parsed[0].tags.length > 0) {
				// Has JSDoc tags, render as JSDoc
				return this.renderJSDocComment(parsed[0]);
			}

			// No JSDoc tags, try to get description for regular comments
			if (parsed.length > 0 && parsed[0].description) {
				const renderedContent = marked.parseInline(
					parsed[0].description,
				);
				return `<span class="token-comment">${renderedContent}</span>`;
			}

			// Fallback to basic rendering - use marked for inline markdown
			const renderedContent = marked.parseInline(commentText);
			return `<span class="token-comment">${renderedContent}</span>`;
		} catch (error) {
			// Fallback to simple escaped comment
			return `<span class="token-comment">${this.escapeHtml(commentText)}</span>`;
		}
	}

	/**
	 * Render JSDoc comment using parsed comment-parser result
	 */
	private renderJSDocComment(jsdoc: any): string {
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
	private renderJSDocTag(tag: any): string {
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
	 * Generate HTML using segmented rendering approach with comment handling
	 */
	private generateSegmentedHTML(fileIR: FileIR, info: TokenInfo[]): string {
		// Read source file content
		const sourcePath = path.resolve(fileIR.filePath);
		const sourceContent = fs.readFileSync(sourcePath, "utf-8");

		// Separate comment and non-comment tokens
		const commentTokens = info.filter((token) =>
			token.meta.some((m) => m.type === "comment"),
		);
		const otherTokens = info.filter(
			(token) => !token.meta.some((m) => m.type === "comment"),
		);

		// Sort all tokens by position for proper processing
		const allTokens = [...otherTokens, ...commentTokens].sort((a, b) => {
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}
			return a.span.start.column - b.span.start.column;
		});

		let result = "";
		let currentOffset = 0;

		// Process tokens in order
		for (const token of allTokens) {
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

			// Handle token based on its meta
			const isCommentToken = token.meta.some((m) => m.type === "comment");

			if (isCommentToken) {
				// Extract comment content from source
				const commentText = sourceContent.slice(tokenStart, tokenEnd);
				const renderedComment = this.renderCommentToken(commentText);
				result += renderedComment;
			} else {
				// Handle syntax highlighting and other tokens
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
	private wrapInHTMLTemplate(fileIR: FileIR, content: string): string {
		const fileName = path.basename(fileIR.filePath);
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName} - Cire Documentation</title>
    <link rel="stylesheet" href="./default.css">
</head>
<body>
    <div class="container">
        <h1>${fileName}</h1>
        <p>Generated by <strong>Cire</strong> - Static Documentation Generator with IDE-like features</p>
        <div>
            ${content}
        </div>
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
