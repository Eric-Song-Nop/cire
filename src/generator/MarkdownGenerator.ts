import * as fs from "node:fs";
import * as path from "node:path";
import * as commentParser from "comment-parser";
import type { FileIR, TokenInfo } from "../types";
import { BaseGenerator } from "./BaseGenerator";
import { escapeHtml } from "./Escapes";

/**
 * MarkdownGenerator - Generates markdown documentation from source code with syntax highlighting,
 * hover documentation, and definition jumping capabilities using <code> regions instead of markdown code blocks.
 */
class MarkdownGenerator extends BaseGenerator {
	/**
	 * Generate markdown from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

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
			return this.generateHighlightedMarkdown(sourceContent, info);
		}

		// Markdown-style rendering approach
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
	 * Generate highlighted markdown, preserving all source text
	 */
	private generateHighlightedMarkdown(
		sourceContent: string,
		tokens: TokenInfo[],
	): string {
		if (tokens.length === 0) {
			// No highlight tokens, just escape and wrap in <code>
			// Use HTML escaping for content inside <pre><code> blocks
			return this.wrapCodeBlock(escapeHtml(sourceContent));
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
				result += escapeHtml(textBefore);
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
					dataAttrs += ` data-hover-content="${escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						// hoverDocumentation is already HTML from marked.parse(), don't escape it
						dataAttrs += ` data-hover-documentation="${tokenInfo.hoverDocumentation}"`;
					}
				}
				if (tokenInfo.definitionInfo) {
					dataAttrs += ` data-definition-file="${escapeHtml(tokenInfo.definitionInfo.filePath)}"`;
					dataAttrs += ` data-definition-line="${tokenInfo.definitionInfo.pos.line}"`;
					dataAttrs += ` data-definition-column="${tokenInfo.definitionInfo.pos.column}"`;

					// Also store this token's own position for definition jumping
					dataAttrs += ` data-token-line="${token.span.start.line}"`;
					dataAttrs += ` data-token-column="${token.span.start.column}"`;
				}

				result += `<span${classAttr}${dataAttrs}>${escapeHtml(tokenText)}</span>`;
			} else {
				// No classes or hover info, just escape the text
				result += escapeHtml(tokenText);
			}

			currentOffset = tokenEnd;
		}

		// Add remaining text after last token
		if (currentOffset < sourceContent.length) {
			const remainingText = sourceContent.slice(currentOffset);
			result += escapeHtml(remainingText);
		}

		// Ensure the result preserves newlines properly for markdown rendering
		return this.wrapCodeBlock(result);
	}
}

export { MarkdownGenerator };
export default MarkdownGenerator;
