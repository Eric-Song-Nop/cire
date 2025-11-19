import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "comment-parser";
import { marked } from "marked";
import { match } from "ts-pattern";
import { HandlebarsTemplateEngine } from "../template/HandlebarsTemplateEngine";
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
 * # HTMLGenerator
 *
 * This class implements the DocGenerator interface and is responsible for converting source code into HTML format documentation.
 * Main features include:
 * - Syntax highlighting
 * - Hover documentation tooltips
 * - Definition jumping capabilities
 * - Wrapping code blocks with `<div><pre><code>` regions
 * - Parsing comments as Markdown and rendering them as HTML
 *
 * Relies on a template engine to render the final HTML pages.
 */
class HTMLGenerator implements DocGenerator {
	private sourceContent: string = "";
	private sourceCode: string[] = [];
	private tokens: TokenInfo[] = [];
	private _config: CireConfig;
	private templateEngine: HandlebarsTemplateEngine;

	constructor(config: CireConfig) {
		this._config = config;
		// Initialize template engine with default template directory
		const defaultTemplateDir = path.join(__dirname, "../../templates");
		const templateDir = config.template?.templateDir || defaultTemplateDir;
		this.templateEngine = new HandlebarsTemplateEngine(
			templateDir,
			config.template?.templateDir,
		);
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

			// Generate core content
			const content = this.generateContent();

			// Prepare template data
			const templateData = this.prepareTemplateData(fileIR, content);

			// Render using template engine
			const layout = this._config.template?.layout || "default";
			return this.templateEngine.render(layout, templateData);
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.relativePath}: ${error}`,
			);
		}
	}

	/**
	 * Generates core HTML content from tokens
	 *
	 * This method processes sorted tokens, handling code and comment regions separately:
	 * - Non-comment regions: Wrapped with `<div><pre><code></code></pre></div>` to preserve code formatting
	 * - Comment regions: Parsed as Markdown and rendered as HTML
	 *
	 * Processing logic:
	 * 1. Iterate through all tokens (sorted, non-overlapping, covering entire source code)
	 * 2. Switch between code/comment modes based on token type
	 * 3. Add IDs for symbol definitions and links for symbol references
	 * 4. Apply syntax highlighting classes
	 * 5. Generate complete HTML content string
	 *
	 * @returns Complete HTML content string
	 */
	private generateContent(): string {
		let result = "";
		let isCode = false;
		for (const currentToken of this.tokens) {
			const tokenContent = this.getTextFromSource(currentToken.span);
			// Escape HTML content for code blocks
			const escapedTokenContent = escapeHtml(tokenContent);

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
								content = escapedTokenContent;
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
							)
							.with(
								{ type: "highlight" },
								({ highlightClasses }) => {
									classes.push(...highlightClasses);
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
				tokenElement += escapedTokenContent;
				if (anchor) tokenElement += "</a>";
				tokenElement += "</span>";
				result += tokenElement;
			}
		}
		return result;
	}

	/**
	 * Prepares data required for template rendering
	 *
	 * Collects and calculates all data needed by the template, including:
	 * - Page title
	 * - Generated content
	 * - CSS file paths (relative paths)
	 * - Home page link path
	 * - Feature toggle configurations
	 * - Layout template name
	 *
	 * @param fileIR - File intermediate representation
	 * @param content - Generated HTML content
	 * @returns Template data object
	 */
	private prepareTemplateData(fileIR: FileIR, content: string) {
		// Calculate relative path to CSS file
		const cssRelativePath = this.calculateRelativePath(
			fileIR.relativePath,
			"default.css",
		);

		// Calculate relative path to home page
		const homePageRelativePath = this.calculateRelativePath(
			fileIR.relativePath,
			"cireIndex.html",
		);

		return {
			title: `${fileIR.relativePath} - Documentation`,
			content: content,
			cssFiles: [cssRelativePath],
			homePagePath: homePageRelativePath,
			features: {
				syntaxHighlighting:
					this._config.features?.syntaxHighlighting ?? true,
				hoverDocumentation:
					this._config.features?.hoverDocumentation ?? false,
				definitionJumping:
					this._config.features?.definitionJumping ?? false,
				commentMarkdown: this._config.features?.commentMarkdown ?? true,
				navigationIndex: this._config.features?.navigationIndex ?? true,
			},
			layout: this._config.template?.layout || "default",
		};
	}

	/**
	 * Calculates relative path from current file to target file
	 *
	 * Generates appropriate relative path based on current file's directory depth:
	 * - If current file is in root directory, returns `./targetFile`
	 * - Otherwise adds appropriate number of `../` based on directory depth
	 *
	 * @param currentFilePath - Relative path of current file
	 * @param targetFile - Target file name
	 * @returns Relative path string
	 */
	private calculateRelativePath(
		currentFilePath: string,
		targetFile: string,
	): string {
		// If current file is in root directory, just return target file name
		if (!currentFilePath.includes("/")) {
			return `./${targetFile}`;
		}

		// Get directory depth of current file
		const depth = currentFilePath.split("/").length - 1;

		// Build relative path with appropriate number of ../
		const prefix = depth > 0 ? "../".repeat(depth) : "./";
		return `${prefix}${targetFile}`;
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
export { HTMLGenerator };
export default HTMLGenerator;
