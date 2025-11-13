import * as fs from "node:fs";
import * as path from "node:path";
import * as commentParser from "comment-parser";
import { marked } from "marked";
import { match } from "ts-pattern";
import {
	HandlebarsTemplateEngine,
	type TemplateData,
} from "../template/HandlebarsTemplateEngine";
import type {
	CireConfig,
	DocGenerator,
	FileIR,
	Position,
	TokenInfo,
} from "../types";

/**
 * We turn the source code with Highlight Info into HTML
 * Only syntax highlighting is considered - hover and definition are ignored for now
 */
class HTMLGenerator implements DocGenerator {
	private templateEngine: HandlebarsTemplateEngine;
	private config: CireConfig;

	constructor(config: CireConfig) {
		this.config = config;
		const defaultTemplateDir = path.join(__dirname, "../../templates");
		const templateDir = config.template?.templateDir || defaultTemplateDir;
		this.templateEngine = new HandlebarsTemplateEngine(templateDir);
	}
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
	 * Extract token information including classes, hover data, and definition info
	 */
	private extractTokenInfo(meta: TokenInfo["meta"]): {
		classes: string[];
		hoverContent?: string;
		hoverDocumentation?: string;
		definitionInfo?: {
			filePath: string;
			pos: Position;
		};
	} {
		const classes: string[] = [];
		let hoverContent: string | undefined;
		let hoverDocumentation: string | undefined;
		let definitionInfo: { filePath: string; pos: Position } | undefined;

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
				.with({ type: "definition" }, (md) => {
					classes.push("token-clickable", "token-definition");
					definitionInfo = {
						filePath: md.filePath,
						pos: md.pos,
					};
				})
				.with({ type: "comment" }, () => {})
				.exhaustive();
		});

		return {
			classes,
			hoverContent,
			hoverDocumentation,
			definitionInfo,
		};
	}

	/**
	 * Generate HTML from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			// Read source file content
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

			// Generate HTML content using existing logic
			const htmlContent = this.generateContent(
				fileIR,
				sourceContent,
				info,
			);

			// Prepare template data
			const templateData = this.prepareTemplateData(
				fileIR,
				htmlContent,
				projectRoot,
			);

			// Use template engine to render final HTML
			const layout = this.config.template?.layout || "default";
			return this.templateEngine.render(layout, templateData);
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * Generate HTML content (existing logic)
	 */
	private generateContent(
		fileIR: FileIR,
		sourceContent: string,
		info: TokenInfo[],
	): string {
		// Check if we have comment tokens - if not, use original method
		const hasCommentTokens = info.some((token) =>
			token.meta.some((m) => m.type === "comment"),
		);

		if (!hasCommentTokens) {
			// Original method for backward compatibility
			// Tokens are already sorted by SortTokenPass
			return this.generateHighlightedHTML(sourceContent, info);
		}

		// New Markdown-style rendering approach
		return this.generateMarkdownHTML(fileIR, sourceContent, info);
	}

	/**
	 * Prepare template data for handlebars rendering
	 */
	private prepareTemplateData(
		fileIR: FileIR,
		htmlContent: string,
		projectRoot: string,
	): TemplateData {
		const fileName = path.basename(fileIR.relativePath);
		const cssPath = this.calculateCSSPath(fileIR);

		const templateData = {
			title: `${fileName} - ${this.config.name || "Cire Documentation"}`,
			content: htmlContent,
			cssFiles: [cssPath],
			customCSS: this.config.template?.customCSS,
			features: {
				syntaxHighlighting:
					this.config.features?.syntaxHighlighting ?? true,
				hoverDocumentation:
					this.config.features?.hoverDocumentation ?? true,
				definitionJumping:
					this.config.features?.definitionJumping ?? true,
				commentMarkdown: this.config.features?.commentMarkdown ?? true,
				navigationIndex: this.config.features?.navigationIndex ?? false,
			},
			layout: this.config.template?.layout || "default",
		};

		return templateData;
	}

	/**
	 * Calculate CSS path relative to output file
	 */
	private calculateCSSPath(fileIR: FileIR): string {
		const outputFileDir = path.dirname(fileIR.relativePath);
		return path.relative(outputFileDir, "default.css") || "./default.css";
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

		// Extract comment tokens - already sorted by SortTokenPass
		const commentTokens = info.filter((token) =>
			token.meta.some((m) => m.type === "comment"),
		);

		// Get non-comment tokens for syntax highlighting - already sorted by SortTokenPass
		const nonCommentTokens = info.filter(
			(token) => !token.meta.some((m) => m.type === "comment"),
		);

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
				result += `${this.escapeHtml(line)}\n`;
			} else {
				// Process tokens on this line
				const lineContent = this.processTokensOnLine(
					sourceContent,
					lineNum,
					lineTokens,
				);
				result += `${lineContent}\n`;

				// Check if the last token spans multiple lines and skip already processed lines
				const lastToken = lineTokens[lineTokens.length - 1];
				const lastTokenEndLine = lastToken.span.end.line;
				if (lastTokenEndLine > lineNum) {
					lineNum = lastTokenEndLine;
				}
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

		// Tokens are already sorted by SortTokenPass - no need to sort again

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

			if (
				tokenInfo.classes.length > 0 ||
				tokenInfo.hoverContent ||
				tokenInfo.definitionInfo
			) {
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
				if (tokenInfo.definitionInfo) {
					dataAttrs += ` data-definition-file="${this.escapeHtml(tokenInfo.definitionInfo.filePath)}"`;
					dataAttrs += ` data-definition-line="${tokenInfo.definitionInfo.pos.line}"`;
					dataAttrs += ` data-definition-column="${tokenInfo.definitionInfo.pos.column}"`;

					// Also store this token's own position for definition jumping
					dataAttrs += ` data-token-line="${token.span.start.line}"`;
					dataAttrs += ` data-token-column="${token.span.start.column}"`;
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

			if (
				tokenInfo.classes.length > 0 ||
				tokenInfo.hoverContent ||
				tokenInfo.definitionInfo
			) {
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
				if (tokenInfo.definitionInfo) {
					dataAttrs += ` data-definition-file="${this.escapeHtml(tokenInfo.definitionInfo.filePath)}"`;
					dataAttrs += ` data-definition-line="${tokenInfo.definitionInfo.pos.line}"`;
					dataAttrs += ` data-definition-column="${tokenInfo.definitionInfo.pos.column}"`;

					// Also store this token's own position for definition jumping
					dataAttrs += ` data-token-line="${token.span.start.line}"`;
					dataAttrs += ` data-token-column="${token.span.start.column}"`;
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
}

export { HTMLGenerator };
export default HTMLGenerator;
