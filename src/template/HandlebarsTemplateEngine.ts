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

	// Layout
	layout?: string;
}

/**
 * Template configuration
 */
export interface TemplateConfig {
	layout: string;
	templateDir?: string;
	customCSS?: string;
}

/**
 * Handlbars template engine implementation
 */
export class HandlebarsTemplateEngine {
	private handlebars: typeof Handlebars;
	private defaultTemplateDir: string;
	private customTemplateDir?: string;
	private compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();
	private partialsLoaded = false;

	constructor(defaultTemplateDir: string, customTemplateDir?: string) {
		this.handlebars = Handlebars.create();
		this.defaultTemplateDir = defaultTemplateDir;
		this.customTemplateDir = customTemplateDir;
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
	 * Custom partials directory takes priority over default one
	 */
	private loadPartials() {
		if (this.partialsLoaded) return;

		// Helper function to load partials from a directory
		const loadPartialsFromDir = (partialsDir: string) => {
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
		};

		// Load from custom template directory first (higher priority)
		if (this.customTemplateDir) {
			loadPartialsFromDir(path.join(this.customTemplateDir, "partials"));
		}

		// Load from default template directory (fallback)
		loadPartialsFromDir(path.join(this.defaultTemplateDir, "partials"));

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
	 * Custom template directory takes priority over default one
	 */
	private getCompiledTemplate(
		templateName: string,
	): HandlebarsTemplateDelegate {
		if (!this.compiledTemplates.has(templateName)) {
			let templateContent: string | undefined;
			let templatePath: string | undefined;

			// Try custom template directory first
			if (this.customTemplateDir) {
				templatePath = path.join(
					this.customTemplateDir,
					"layouts",
					`${templateName}.hbs`,
				);
				if (fs.existsSync(templatePath)) {
					templateContent = fs.readFileSync(templatePath, "utf-8");
				}
			}

			// Fallback to default template directory
			if (!templateContent) {
				templatePath = path.join(
					this.defaultTemplateDir,
					"layouts",
					`${templateName}.hbs`,
				);
				if (fs.existsSync(templatePath)) {
					templateContent = fs.readFileSync(templatePath, "utf-8");
				}
			}

			// If still not found, throw error
			if (!templateContent) {
				const searchPaths = [
					this.customTemplateDir
						? path.join(
								this.customTemplateDir,
								"layouts",
								`${templateName}.hbs`,
							)
						: undefined,
					path.join(
						this.defaultTemplateDir,
						"layouts",
						`${templateName}.hbs`,
					),
				]
					.filter(Boolean)
					.join(", ");

				throw new Error(
					`Template not found: ${templateName} (searched in: ${searchPaths})`,
				);
			}

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
		// Check custom template directory first
		if (this.customTemplateDir) {
			const customTemplatePath = path.join(
				this.customTemplateDir,
				"layouts",
				`${templateName}.hbs`,
			);
			if (fs.existsSync(customTemplatePath)) {
				return true;
			}
		}

		// Check default template directory
		const defaultTemplatePath = path.join(
			this.defaultTemplateDir,
			"layouts",
			`${templateName}.hbs`,
		);
		return fs.existsSync(defaultTemplatePath);
	}

	/**
	 * Get list of available layout templates
	 * Custom templates take priority over default ones
	 */
	getAvailableLayouts(): string[] {
		const availableLayouts = new Set<string>();

		// Helper function to collect layouts from a directory
		const collectLayoutsFromDir = (layoutsDir: string) => {
			if (fs.existsSync(layoutsDir)) {
				const files = fs.readdirSync(layoutsDir);
				files
					.filter((file) => file.endsWith(".hbs"))
					.forEach((file) => {
						const layoutName = path.basename(file, ".hbs");
						availableLayouts.add(layoutName);
					});
			}
		};

		// Collect from custom template directory
		if (this.customTemplateDir) {
			collectLayoutsFromDir(path.join(this.customTemplateDir, "layouts"));
		}

		// Collect from default template directory
		collectLayoutsFromDir(path.join(this.defaultTemplateDir, "layouts"));

		return Array.from(availableLayouts).sort();
	}
}
