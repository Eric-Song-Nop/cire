import * as fs from "node:fs";
import * as path from "node:path";
import * as commentParser from "comment-parser";
import { marked } from "marked";
import { match } from "ts-pattern";
import type {
	CireConfig,
	DocGenerator,
	FileIR,
	Position,
	TokenInfo,
} from "../types";

/**
 * MarkdownGenerator - Generates markdown documentation from source code with syntax highlighting,
 * hover documentation, and definition jumping capabilities using <code> regions instead of markdown code blocks.
 */
class MarkdownGenerator implements DocGenerator {
	private config: CireConfig;

	constructor(config: CireConfig) {
		this.config = config;
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
	 * Escape markdown special characters to prevent rendering issues
	 */
	private escapeMarkdown(text: string): string {
		// Escape markdown special characters but preserve code structure
		// CRITICAL: Do NOT escape hyphens at all - they are too problematic in code
		return text
			.replace(/\\/g, "\\\\") // Escape backslashes first
			.replace(/`/g, "\\`") // Escape backticks
			.replace(/\*/g, "\\*") // Escape asterisks
			.replace(/_/g, "\\_") // Escape underscores
			.replace(/\{/g, "\\{") // Escape curly braces
			.replace(/\}/g, "\\}") // Escape curly braces
			.replace(/\[/g, "\\[") // Escape square brackets
			.replace(/\]/g, "\\]") // Escape square brackets
			.replace(/\(/g, "\\(") // Escape parentheses
			.replace(/\)/g, "\\)") // Escape parentheses
			.replace(/#/g, "\\#") // Escape hash symbols
			.replace(/\+/g, "\\+") // Escape plus signs
			.replace(/\./g, "\\.") // Escape periods
			.replace(/!/g, "\\!"); // Escape exclamation marks
	}

	/**
	 * Escape HTML special characters for content inside <pre><code> blocks and HTML attributes
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&")
			.replace(/</g, "<")
			.replace(/>/g, ">")
			.replace(/"/g, '"')
			.replace(/'/g, "'");
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
							hoverDocumentation = this.escapeMarkdown(
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
	 * Generate markdown from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			// Read source file content
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

			// Generate markdown content
			return this.generateContent(fileIR, sourceContent, info);
		} catch (error) {
			throw new Error(
				`Failed to generate markdown for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * Generate markdown content
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
			return this.generateHighlightedMarkdown(sourceContent, info);
		}

		// New Markdown-style rendering approach
		return this.generateMarkdownWithComments(fileIR, sourceContent, info);
	}

	/**
	 * Render comment token to markdown with comment-parser integration
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

			return `${rebuiltDescription}\n\n`;
		}

		// Should not happen, but handle empty parsed result
		return `${commentText}\n\n`;
	}

	/**
	 * Render JSDoc comment using parsed comment-parser result
	 */
	private renderJSDocComment(jsdoc: commentParser.Block): string {
		let markdown = "";

		// Render main description without HTML conversion
		if (jsdoc.description) {
			markdown += `${jsdoc.description}\n\n`;
		}

		// Render tags
		markdown += "### Parameters & Returns\n\n";
		for (const tag of jsdoc.tags) {
			markdown += this.renderJSDocTag(tag);
		}

		return `${markdown}\n\n`;
	}

	/**
	 * Render individual JSDoc tag
	 */
	private renderJSDocTag(tag: commentParser.Spec): string {
		const tagName = tag.tag || "";
		const name = tag.name || "";
		const description = tag.description || "";

		let tagContent = `**@${tagName}**`;

		if (name) {
			tagContent += ` \`${name}\``;
		}

		if (description) {
			tagContent += ` - ${description}`;
		}

		return `${tagContent}\n\n`;
	}

	/**
	 * Generate markdown separating comments and code with syntax highlighting
	 */
	private generateMarkdownWithComments(
		_fileIR: FileIR,
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
					result.push(this.wrapCodeBlock(highlightedCode));
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
				result.push(this.wrapCodeBlock(highlightedCode));
			}
		}

		// Join with newlines to ensure proper separation
		return result.join("\n");
	}

	/**
	 * Wrap code in <code> region with syntax highlighting classes
	 */
	private wrapCodeBlock(code: string): string {
		// Ensure proper separation with triple newlines
		return `<pre><code>${code}</code></pre>\n\n`;
	}

	/**
	 * Generate highlighted markdown for a specific line range
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
				// Add newline only if this is not the last line
				const lineEnding = lineNum < endLine ? "\n" : "";
				result += `${this.escapeHtml(line)}${lineEnding}`;
			} else {
				// Process tokens on this line
				const lineContent = this.processTokensOnLine(
					sourceContent,
					lineNum,
					lineTokens,
				);
				// Add newline only if this is not the last line
				const lineEnding = lineNum < endLine ? "\n" : "";
				result += `${lineContent}${lineEnding}`;

				// Check if the last token spans multiple lines and skip already processed lines
				const lastToken = lineTokens[lineTokens.length - 1];
				const lastTokenEndLine = lastToken.span.end.line;
				if (lastTokenEndLine > lineNum) {
					lineNum = lastTokenEndLine;
				}
			}
		}

		// Return the result without trimming to preserve leading/trailing newlines
		// The result already has proper newlines for each line, no extra trimming needed
		return result;
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

			// Add token with styling and data attributes
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
				if (
					tokenInfo.hoverContent &&
					this.config.features?.hoverDocumentation
				) {
					dataAttrs += ` data-hover-content="${this.escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						// hoverDocumentation is already HTML from marked.parse(), don't escape it
						dataAttrs += ` data-hover-documentation="${tokenInfo.hoverDocumentation}"`;
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
	 * Generate highlighted markdown, preserving all source text
	 */
	private generateHighlightedMarkdown(
		sourceContent: string,
		tokens: TokenInfo[],
	): string {
		if (tokens.length === 0) {
			// No highlight tokens, just escape and wrap in <code>
			// Use HTML escaping for content inside <pre><code> blocks
			return this.wrapCodeBlock(this.escapeHtml(sourceContent));
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
				if (
					tokenInfo.hoverContent &&
					this.config.features?.hoverDocumentation
				) {
					dataAttrs += ` data-hover-content="${this.escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						// hoverDocumentation is already HTML from marked.parse(), don't escape it
						dataAttrs += ` data-hover-documentation="${tokenInfo.hoverDocumentation}"`;
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

		// Ensure the result preserves newlines properly for markdown rendering
		return this.wrapCodeBlock(result);
	}
}

export { MarkdownGenerator };
export default MarkdownGenerator;
