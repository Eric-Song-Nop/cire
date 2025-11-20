import fs from "node:fs";
import path from "node:path";
import { parse } from "comment-parser";
import { match } from "ts-pattern";
import type {
	CireConfig,
	DocGenerator,
	FileIR,
	Position,
	TextSpan,
	TokenInfo,
} from "../types";
import { escapeHtml } from "./Escapes";

/**
 * MarkdownGenerator - Generates markdown documentation from source code with syntax highlighting,
 * hover documentation, and definition jumping capabilities using <code> regions instead of markdown code blocks.
 */
class MarkdownGenerator implements DocGenerator {
	private sourceContent: string = "";
	private sourceCode: string[] = [];
	private tokens: TokenInfo[] = [];
	constructor(config: CireConfig) {
		console.log(config);
	}

	private positionToOffset(pos: Position): number {
		const fixedPos = { ...pos };
		let fix = 0;
		if (pos.column === Number.MAX_SAFE_INTEGER) {
			// Special case for end of line
			fixedPos.line = pos.line + 1;
			fixedPos.column = 0;
			fix = 1;
		}
		let offset = 0;
		for (let i = 0; i < fixedPos.line; i++) {
			offset += this.sourceCode[i].length + 1;
		}
		offset += fixedPos.column;
		return offset - fix;
	}

	/**
	 * Generates markdown content from tokens
	 *
	 * Remember that tokens
	 * 1. are sorted
	 * 2. cover the whole source code
	 * 3. none of them spread over multiple lines
	 * 4. don't overlap with each other.
	 */
	private generateContent(): string {
		let result = "";
		let isCode = false;
		console.log(`Generating content: ${this.tokens.length}`);
		for (const currentToken of this.tokens) {
			const tokenContent = this.getTextFromSource(currentToken.span);
			// Escape HTML content for code blocks
			const escapedTokenContent = escapeHtml(tokenContent);
			const classes: string[] = [];
			let id: string = "";
			let anchor: string | undefined;
			let content: string | undefined;
			let isEndOfLine = false;
			if (currentToken.meta.some((m) => m.type === "endOfFile")) {
				if (isCode) result += `</code></pre></div>\n\n`;
				return result;
			}
			for (const meta of currentToken.meta) {
				match(meta)
					.with({ type: "comment" }, () => {
						if (isCode) {
							result += `</code></pre></div>\n\n`;
							isCode = false;
						}
					})
					.with(
						{ type: "plaintext" },
						{ type: "symbolDefinition" },
						{ type: "symbolReference" },
						{ type: "hover" },
						{ type: "highlight" },
						() => {
							if (!isCode) {
								result += `<div class="language-ts"><pre><code>`;
								isCode = true;
							}
						},
					);
			}
			for (const meta of currentToken.meta) {
				match(meta)
					.with({ type: "comment" }, () => {
						content = parse(tokenContent)
							.map((blk) => {
								return blk.source
									.map((src) => {
										return src.tokens.description;
									})
									.join("\n");
							})
							.join("\n");
					})
					.with({ type: "startOfLine" }, () => {
						if (isCode) result += `<span class="line">`;
					})
					.with({ type: "endOfLine" }, () => {
						isEndOfLine = true;
					})
					.with({ type: "plaintext" }, () => {
						content = escapedTokenContent;
					})
					.with({ type: "symbolDefinition" }, ({ symbolId }) => {
						id = `id="symbol-${symbolId}" `;
					})
					.with({ type: "symbolReference" }, ({ symbolId }) => {
						anchor = `#symbol-${symbolId}`;
					})
					.with({ type: "highlight" }, ({ highlightClasses }) => {
						classes.push(...highlightClasses);
					});
			}

			if (content) result += content;
			else {
				let tokenElement = `<span ${id}`;
				if (classes.length > 0) {
					tokenElement += `class="${classes.join(" ")}" `;
				}
				if (anchor) {
					tokenElement += `><a href="${anchor}">`;
				} else {
					tokenElement += ">";
				}
				tokenElement += escapedTokenContent;
				if (anchor) tokenElement += "</a>";
				tokenElement += "</span>";
				result += tokenElement;
			}
			if (isEndOfLine) {
				if (isCode) result += `</span>`;
				result += "\n";
			}
		}
		return result;
	}

	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			this.sourceContent = fs.readFileSync(sourcePath, "utf-8");
			this.sourceCode = this.sourceContent.split("\n");
			this.tokens = info;

			// Generate core content
			const content = this.generateContent();
			return content;
		} catch (error) {
			throw new Error(
				`Failed to generate Markdown for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * Extracts content from source code within specified text range
	 *
	 * @param span - Text span (containing start and end positions)
	 * @returns Extracted text content
	 */
	private getTextFromSource(span: TextSpan) {
		const startOffset = this.positionToOffset(span.start);
		const endOffset = this.positionToOffset(span.end);
		return this.sourceContent.slice(startOffset, endOffset);
	}
}
export { MarkdownGenerator };
export default MarkdownGenerator;
