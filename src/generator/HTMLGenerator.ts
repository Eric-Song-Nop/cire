import * as fs from "node:fs";
import * as path from "node:path";
import type * as commentParser from "comment-parser";
import { marked } from "marked";
import {
	HandlebarsTemplateEngine,
	type TemplateData,
} from "../template/HandlebarsTemplateEngine";
import type { CireConfig, FileIR, TokenInfo } from "../types";
import { BaseGenerator } from "./BaseGenerator";
import { escapeHtml } from "./Escapes";

/**
 * We turn the source code with Highlight Info into HTML
 * Only syntax highlighting is considered - hover and definition are ignored for now
 */
class HTMLGenerator extends BaseGenerator {
	private templateEngine: HandlebarsTemplateEngine;

	constructor(config: CireConfig) {
		super(config);
		const defaultTemplateDir = path.join(__dirname, "../../templates");
		const templateDir = config.template?.templateDir || defaultTemplateDir;
		this.templateEngine = new HandlebarsTemplateEngine(templateDir);
	}

	/**
	 * Generate HTML from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string {
		try {
			const sourcePath = path.join(projectRoot, fileIR.relativePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

			const htmlContent = this.generateContent(
				fileIR,
				sourceContent,
				info,
			);

			const templateData = this.prepareTemplateData(
				fileIR,
				htmlContent,
				projectRoot,
			);

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
		_fileIR: FileIR,
		sourceContent: string,
		info: TokenInfo[],
	): string {
		// Check if we have comment tokens - if not, use original method
		const hasCommentTokens = info.some((token) =>
			token.meta.some((m) => m.type === "comment"),
		);

		if (!hasCommentTokens) {
			// Tokens are already sorted by SortTokenPass
			return this.generateHighlightedContent(
				sourceContent,
				info,
				(content) => `<pre><code>${content}</code></pre>`,
			);
		}

		// Markdown-style rendering approach
		return this.generateMarkdownStyleContent(
			sourceContent,
			info,
			(content) => `<pre><code>${content}</code></pre>`,
			(content) => `<div class="markdown-content">${content}</div>`,
		);
	}

	/**
	 * Prepare template data for handlebars rendering
	 */
	private prepareTemplateData(
		fileIR: FileIR,
		htmlContent: string,
		_projectRoot: string,
	): TemplateData {
		const fileName = path.basename(fileIR.relativePath);
		const cssPath = this.calculateCSSPath(fileIR);
		const homePagePath = this.calculateHomePagePath(fileIR);

		const templateData = {
			title: `${fileName} - ${this.config.name || "Cire Documentation"}`,
			content: htmlContent,
			cssFiles: [cssPath],
			homePagePath,
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
	 * Calculate home page path relative to output file
	 */
	private calculateHomePagePath(fileIR: FileIR): string {
		const outputFileDir = path.dirname(fileIR.relativePath);
		return (
			path.relative(outputFileDir, "cireIndex.html") || "./cireIndex.html"
		);
	}

	/**
	 * Render comment content for HTML
	 */
	protected renderCommentContent(content: string): string {
		const renderedContent = marked.parse(content);
		return `<div class="token-comment">${renderedContent}</div>`;
	}

	/**
	 * Render JSDoc description for HTML
	 */
	protected renderJSDocDescription(description: string): string {
		return `<div class="jsdoc-description">${marked.parseInline(description)}</div>`;
	}

	/**
	 * Render JSDoc tags for HTML
	 */
	protected renderJSDocTags(tags: commentParser.Spec[]): string {
		let html = '<div class="jsdoc-tags">';
		for (const tag of tags) {
			html += this.renderJSDocTag(tag);
		}
		html += "</div>";
		return html;
	}

	/**
	 * Render individual JSDoc tag for HTML
	 */
	protected renderJSDocTag(tag: commentParser.Spec): string {
		const tagName = tag.tag || "";
		const name = tag.name || "";
		const description = tag.description || "";

		let tagContent = `<span class="jsdoc-tag-name">@${tagName}</span>`;

		if (name) {
			tagContent += ` <span class="jsdoc-tag-name">${escapeHtml(name)}</span>`;
		}

		if (description) {
			tagContent += ` <span class="jsdoc-tag-description">${marked.parseInline(description)}</span>`;
		}

		return `<div class="jsdoc-tag">${tagContent}</div>`;
	}

	/**
	 * Render JSDoc comment wrapper for HTML
	 */
	protected renderJSDocComment(jsdoc: commentParser.Block): string {
		let html = this.renderJSDocDescription(jsdoc.description);
		html += this.renderJSDocTags(jsdoc.tags);
		return `<span class="token-comment jsdoc-comment">${html}</span>`;
	}
}

export { HTMLGenerator };
export default HTMLGenerator;
