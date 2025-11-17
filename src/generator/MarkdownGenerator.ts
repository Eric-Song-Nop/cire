import * as fs from "node:fs";
import * as path from "node:path";
import type * as commentParser from "comment-parser";
import type { FileIR, TokenInfo } from "../types";
import { BaseGenerator } from "./BaseGenerator";

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
		_fileIR: FileIR,
		sourceContent: string,
		info: TokenInfo[],
	): string {
		// Check if we have comment tokens - if not, use original method
		const hasCommentTokens = info.some((token) =>
			token.meta.some((m) => m.type === "comment"),
		);

		if (!hasCommentTokens) {
			return this.generateHighlightedContent(
				sourceContent,
				info,
				(content) => `<code>${content}</code>`,
			);
		}

		// Markdown-style rendering approach
		return this.generateMarkdownStyleContent(
			sourceContent,
			info,
			(content) => `<pre><code>${content}</code></pre>`,
		);
	}

	/**
	 * Render comment content for Markdown
	 */
	protected renderCommentContent(content: string): string {
		return `${content}\n\n`;
	}

	/**
	 * Render JSDoc description for Markdown
	 */
	protected renderJSDocDescription(description: string): string {
		return `${description}\n\n`;
	}

	/**
	 * Render JSDoc tags for Markdown
	 */
	protected renderJSDocTags(tags: commentParser.Spec[]): string {
		let markdown = "### Parameters & Returns\n\n";
		for (const tag of tags) {
			markdown += this.renderJSDocTag(tag);
		}
		return markdown;
	}

	/**
	 * Render individual JSDoc tag for Markdown
	 */
	protected renderJSDocTag(tag: commentParser.Spec): string {
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
	 * Render JSDoc comment wrapper for Markdown
	 */
	protected renderJSDocComment(jsdoc: commentParser.Block): string {
		let markdown = this.renderJSDocDescription(jsdoc.description);
		markdown += this.renderJSDocTags(jsdoc.tags);
		return `${markdown}\n\n`;
	}
}
export { MarkdownGenerator };
export default MarkdownGenerator;
