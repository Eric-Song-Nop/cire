import { marked } from "marked";
import { match } from "ts-pattern";
import type {
	CireConfig,
	DocGenerator,
	FileIR,
	Position,
	TokenInfo,
} from "../types";
import { escapeHtml } from "./Escapes";

/**
 * BaseGenerator - Base class containing shared functionality for document generators
 * This class provides common methods for position conversion, token extraction, and code highlighting
 */
abstract class BaseGenerator implements DocGenerator {
	protected config: CireConfig;

	constructor(config: CireConfig) {
		this.config = config;
	}

	/**
	 * Convert position to character offset in source text
	 */
	protected positionToOffset(text: string, pos: Position): number {
		const lines = text.split("\n");
		let offset = 0;

		for (let i = 0; i < pos.line; i++) {
			offset += lines[i].length + 1; // +1 for newline
		}

		return offset + pos.column;
	}

	/**
	 * Extract token information including classes, hover data, and definition info
	 */
	protected extractTokenInfo(meta: TokenInfo["meta"]): {
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
					if (mh.documentation) {
						try {
							hoverDocumentation = marked.parse(mh.documentation);
						} catch (error) {
							console.warn(error);
							// Fallback to escaped documentation if processing fails
							hoverDocumentation = escapeHtml(mh.documentation);
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
	 * Generate highlighted code for a specific line range
	 */
	protected generateHighlightedCodeSegment(
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
				result += `${escapeHtml(line)}\n`;
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
	protected processTokensOnLine(
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
				result += escapeHtml(textBefore);
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
				if (
					tokenInfo.hoverContent &&
					this.config.features?.hoverDocumentation
				) {
					dataAttrs += ` data-hover-content="${escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						dataAttrs += ` data-hover-documentation="${escapeHtml(tokenInfo.hoverDocumentation)}"`;
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
				result += escapeHtml(tokenText);
			}

			currentOffset = tokenEnd;
		}

		// Add remaining text after last token
		if (currentOffset < lineEndOffset) {
			const textAfter = sourceContent.slice(currentOffset, lineEndOffset);
			result += escapeHtml(textAfter);
		}

		return result;
	}

	/**
	 * Abstract method to generate documentation - must be implemented by subclasses
	 */
	abstract generate(
		fileIR: FileIR,
		info: TokenInfo[],
		projectRoot: string,
	): string;
}

export { BaseGenerator };
export default BaseGenerator;
