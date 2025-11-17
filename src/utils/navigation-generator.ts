import * as fs from "node:fs";
import * as path from "node:path";
import { HandlebarsTemplateEngine } from "../template/HandlebarsTemplateEngine";
import type { CireConfig } from "../types";

interface TreeNode {
	name: string;
	path: string;
	relativePath?: string;
	type: "file" | "directory";
	children?: TreeNode[];
	href?: string;
}

/**
 * # Navigation Generator - Creates tree-structured navigation page
 *
 * Generates index pages using Handlebars template system for better customization.
 */
export class NavigationGenerator {
	private templateEngine: HandlebarsTemplateEngine;

	constructor(config: CireConfig) {
		const defaultTemplateDir = path.join(__dirname, "../../templates");
		const templateDir = config.template?.templateDir || defaultTemplateDir;
		this.templateEngine = new HandlebarsTemplateEngine(templateDir);
	}

	/**
	 * Build tree structure from file paths
	 */
	private buildTree(files: string[]): TreeNode {
		const root: TreeNode = {
			name: "root",
			path: "",
			type: "directory",
			children: [],
		};

		for (const file of files) {
			const parts = file.split("/").filter((part) => part.length > 0);
			let current = root;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const fullPath = parts.slice(0, i + 1).join("/");
				const isLast = i === parts.length - 1;

				let existingChild = current.children?.find(
					(child) => child.name === part,
				);

				if (!existingChild) {
					existingChild = {
						name: part,
						path: fullPath,
						relativePath: isLast
							? `${fullPath.replace(/\.ts$/, ".html")}`
							: undefined,
						type: isLast ? "file" : "directory",
						children: isLast ? undefined : [],
					};

					if (!current.children) {
						current.children = [];
					}
					current.children.push(existingChild);
				}

				current = existingChild;
			}
		}

		return root;
	}

	/**
	 * Generate navigation page using Handlebars template system
	 */
	generateNavigationPage(files: string[], config: CireConfig): string {
		const tree = this.buildTree(files);
		const totalFiles = files.length;
		const directories = new Set(files.map((f) => path.dirname(f))).size;

		// Prepare template data
		const templateData = {
			title: `${config.name} - Documentation`,
			content: "", // 导航页面不需要额外内容，信息都在 header 中显示
			name: config.name,
			description:
				config.description ||
				"Static website generator providing IDE-like experiences for documentation, generated with <a href='https://github.com/Eric-Song-Nop/cire'>Cire</a>",
			totalFiles,
			directories,
			language: config.input.language || "typescript",
			cssFiles: ["./default.css"],
			features: {
				syntaxHighlighting: false,
				hoverDocumentation: false,
				definitionJumping: false,
				commentMarkdown: false,
				navigationIndex: true,
			},
			tree,
			layout: "index",
		};

		// Render using the index layout
		return this.templateEngine.render("index", templateData);
	}

	/**
	 * Save navigation page to output directory
	 */
	async saveNavigationPage(
		html: string,
		outputDir: string,
		fileName: string = "cireIndex.html",
	): Promise<void> {
		const indexPath = path.join(outputDir, fileName);
		fs.writeFileSync(indexPath, html, "utf-8");
	}
}
