import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "comment-parser";
import { marked } from "marked";
import { match } from "ts-pattern";
import type {
	CireConfig,
	DocGenerator,
	FileIR,
	Position,
	TextSpan,
	TokenInfo,
} from "../types";

/**
 * MarkdownGenerator - Generates markdown documentation from source code with syntax highlighting,
 * hover documentation, and definition jumping capabilities using <code> regions instead of markdown code blocks.
 */
class HTMLGenerator implements DocGenerator {
	private sourceContent: string = "";
	private sourceCode: string[] = [];
	private tokens: TokenInfo[] = [];
	private _config: CireConfig;

	constructor(config: CireConfig) {
		this._config = config;
	}

	private positionToOffset(pos: Position): number {
		if (pos.line === -1 && pos.column === -1) {
			// Special case for end of file
			return this.sourceCode.reduce(
				(acc, line) => acc + line.length + 1,
				0,
			);
		}
		let offset = 0;
		for (let i = 0; i < pos.line; i++) {
			offset += this.sourceCode[i].length + 1;
		}
		offset += pos.column;
		return offset;
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
			return this.process();
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * ## Process the source content with tokenInfos to generate markdown
	 *
	 * We use `<div><pre><code></code></pre></div>` regions to wrap all non-comment regions,
	 * and regard all comment tokens as normal markdown content.
	 * Keep in mind that all tokens are sorted and guaranteed to have no overlap and,
	 * cover the entire source code.
	 *
	 * @returns the full markdown content
	 */
	process(): string {
		let result = "";
		let isCode = false;
		for (const currentToken of this.tokens) {
			const tokenContent = this.getTextFromSource(currentToken.span);
			if (currentToken.meta.some((m) => m.type === "comment")) {
				if (isCode) {
					result += `</code></pre></div>`;
					isCode = false;
				}
			} else {
				if (!isCode) {
					result += `<div><pre><code>`;
					isCode = true;
				}
			}
			const classes: string[] = [];
			let id: string = "";
			let anchor: string | undefined;
			let content: string | undefined;
			for (const meta of currentToken.meta) {
				match(meta)
					.with({ type: "comment" }, () => {
						if (isCode) {
							result += `</code></pre></div>\n\n`;
							isCode = false;
						}
						content = marked(
							parse(tokenContent)
								.map((blk) => {
									return blk.source
										.map((src) => {
											return src.tokens.description;
										})
										.join("\n");
								})
								.join("\n"),
						);
					})
					.otherwise(() => {
						if (!isCode) {
							result += `<div><pre><code>\n`;
							isCode = true;
						}

						match(meta)
							.with({ type: "plaintext" }, () => {
								content = tokenContent;
							})
							.with(
								{ type: "symbolDefinition" },
								({ symbolId }) => {
									id = `id=symbol-${symbolId} `;
								},
							)
							.with(
								{ type: "symbolReference" },
								({ symbolId }) => {
									anchor = `#symbol-${symbolId}`;
								},
							);
					});
			}
			if (content) {
				result += content;
			} else {
				let tokenElement = `<span ${id}`;
				if (classes.length > 0) {
					tokenElement += `class="${classes.join(" ")}" `;
				}
				if (anchor) {
					tokenElement += `><a href="${anchor}">`;
				} else {
					tokenElement += ">";
				}
				tokenElement += tokenContent;
				if (anchor) tokenElement += "</a>";
				tokenElement += "</span>";
				result += tokenElement;
			}
		}
		return result;
	}

	private getTextFromSource(span: TextSpan) {
		const startOffset = this.positionToOffset(span.start);
		const endOffset = this.positionToOffset(span.end);
		return this.sourceContent.slice(startOffset, endOffset);
	}
}
export { HTMLGenerator };
export default HTMLGenerator;
