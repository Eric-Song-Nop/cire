import * as fs from "node:fs";
import * as path from "node:path";
import * as Handlebars from "handlebars";

/**
 * Template data interface for Handlbars templates
 */
export interface TemplateData {
	// Basic data
	title: string;
	content: string;

	// Asset files
	cssFiles: string[];
	customCSS?: string;

	// Feature flags
	features: {
		syntaxHighlighting: boolean;
		hoverDocumentation: boolean;
		definitionJumping: boolean;
		commentMarkdown: boolean;
		navigationIndex: boolean;
	};

	// Theme and layout
	theme?: string;
	layout?: string;
}

/**
 * Template configuration
 */
export interface TemplateConfig {
	layout: string;
	theme?: string;
	customCSS?: string;
}

/**
 * Handlbars template engine implementation
 */
export class HandlebarsTemplateEngine {
	private handlebars: typeof Handlebars;
	private templateDir: string;
	private compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();
	private partialsLoaded = false;

	constructor(templateDir: string) {
		this.handlebars = Handlebars.create();
		this.templateDir = templateDir;
		this.registerHelpers();
	}

	/**
	 * Register custom handlebars helpers
	 */
	private registerHelpers() {
		// Equality helper
		this.handlebars.registerHelper("eq", (a, b) => a === b);
		this.handlebars.registerHelper("ne", (a, b) => a !== b);

		// Logical helpers
		this.handlebars.registerHelper("and", (a, b) => a && b);
		this.handlebars.registerHelper("or", (a, b) => a || b);
		this.handlebars.registerHelper("not", (a) => !a);

		// Conditional helper
		this.handlebars.registerHelper(
			"ifEquals",
			function (this: any, arg1: any, arg2: any, options: any) {
				return arg1 === arg2 ? options.fn(this) : options.inverse(this);
			},
		);

		// Array helpers
		this.handlebars.registerHelper(
			"join",
			(array: string[], separator = ", ") => {
				return Array.isArray(array) ? array.join(separator) : "";
			},
		);

		this.handlebars.registerHelper("length", (array: any[]) => {
			return Array.isArray(array) ? array.length : 0;
		});

		// String helpers
		this.handlebars.registerHelper("uppercase", (str: string) => {
			return str ? str.toUpperCase() : "";
		});

		this.handlebars.registerHelper("lowercase", (str: string) => {
			return str ? str.toLowerCase() : "";
		});

		// JSON helper for debugging
		this.handlebars.registerHelper("json", (obj: any) => {
			return JSON.stringify(obj, null, 2);
		});
	}

	/**
	 * Load all partials from the partials directory
	 */
	private loadPartials() {
		if (this.partialsLoaded) return;

		const partialsDir = path.join(this.templateDir, "partials");

		if (fs.existsSync(partialsDir)) {
			const partialFiles = fs.readdirSync(partialsDir);
			partialFiles.forEach((file) => {
				if (file.endsWith(".hbs")) {
					const name = path.basename(file, ".hbs");
					const content = fs.readFileSync(
						path.join(partialsDir, file),
						"utf-8",
					);
					this.handlebars.registerPartial(name, content);
				}
			});
		}

		this.partialsLoaded = true;
	}

	/**
	 * Render a template with the given data
	 */
	render(layoutName: string, data: TemplateData): string {
		// Ensure partials are loaded
		this.loadPartials();

		// Get compiled template
		const template = this.getCompiledTemplate(layoutName);

		// Render with data
		return template(data);
	}

	/**
	 * Get or compile a template
	 */
	private getCompiledTemplate(
		templateName: string,
	): HandlebarsTemplateDelegate {
		if (!this.compiledTemplates.has(templateName)) {
			const templatePath = path.join(
				this.templateDir,
				"layouts",
				`${templateName}.hbs`,
			);

			if (!fs.existsSync(templatePath)) {
				throw new Error(
					`Template not found: ${templateName} (looked for ${templatePath})`,
				);
			}

			const templateContent = fs.readFileSync(templatePath, "utf-8");
			const compiled = this.handlebars.compile(templateContent);
			this.compiledTemplates.set(templateName, compiled);
		}

		return this.compiledTemplates.get(templateName)!;
	}

	/**
	 * Clear template cache (useful for development)
	 */
	clearCache() {
		this.compiledTemplates.clear();
		this.partialsLoaded = false;
		// Note: Handlbars doesn't have a method to clear all partials at once
		// We'll just reload them when needed
	}

	/**
	 * Reload templates (useful for hot reloading in development)
	 */
	reloadTemplates() {
		this.clearCache();
		this.loadPartials();
	}

	/**
	 * Check if a template exists
	 */
	templateExists(templateName: string): boolean {
		const templatePath = path.join(
			this.templateDir,
			"layouts",
			`${templateName}.hbs`,
		);
		return fs.existsSync(templatePath);
	}

	/**
	 * Get list of available layout templates
	 */
	getAvailableLayouts(): string[] {
		const layoutsDir = path.join(this.templateDir, "layouts");

		if (!fs.existsSync(layoutsDir)) {
			return [];
		}

		const files = fs.readdirSync(layoutsDir);
		return files
			.filter((file) => file.endsWith(".hbs"))
			.map((file) => path.basename(file, ".hbs"));
	}
}
