/**
 * Configuration loader for .cire files
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { CireConfig, ConfigError } from "../types";

export class ConfigLoader {
	/**
	 * Load and validate configuration from a .cire file
	 */
	static loadConfig(configPath: string): CireConfig {
		const fullPath = resolve(process.cwd(), configPath);

		if (!existsSync(fullPath)) {
			throw new ConfigError(
				`Configuration file not found: ${configPath}`,
				fullPath,
			);
		}

		try {
			const configContent = readFileSync(fullPath, "utf-8");
			const config = JSON.parse(configContent) as CireConfig;

			// Validate configuration
			ConfigLoader.validateConfig(config, fullPath);

			return config;
		} catch (error) {
			if (error instanceof ConfigError) {
				throw error;
			}

			if (error instanceof SyntaxError) {
				throw new ConfigError(
					`Invalid JSON in configuration file: ${error.message}`,
					fullPath,
				);
			}

			throw new ConfigError(
				`Failed to load configuration: ${error instanceof Error ? error.message : error}`,
				fullPath,
			);
		}
	}

	/**
	 * Validate configuration structure and required fields
	 */
	private static validateConfig(config: any, configPath: string): void {
		if (!config || typeof config !== "object") {
			throw new ConfigError(
				"Configuration must be a valid JSON object",
				configPath,
			);
		}

		// Validate required fields
		const requiredFields = ["name", "version", "input", "output"];
		for (const field of requiredFields) {
			if (!(field in config)) {
				throw new ConfigError(
					`Missing required field: ${field}`,
					configPath,
				);
			}
		}

		// Validate name
		if (typeof config.name !== "string" || !config.name.trim()) {
			throw new ConfigError(
				'Field "name" must be a non-empty string',
				configPath,
			);
		}

		// Validate version
		if (typeof config.version !== "string" || !config.version.trim()) {
			throw new ConfigError(
				'Field "version" must be a non-empty string',
				configPath,
			);
		}

		// Validate input configuration
		if (!ConfigLoader.validateInputConfig(config.input)) {
			throw new ConfigError(
				'Invalid "input" configuration. Required fields: root (string), include (string[])',
				configPath,
			);
		}

		// Validate output configuration
		if (!ConfigLoader.validateOutputConfig(config.output)) {
			throw new ConfigError(
				'Invalid "output" configuration. Required field: directory (string)',
				configPath,
			);
		}

		// Validate optional LSP configuration
		if (config.lsp && !ConfigLoader.validateLspConfig(config.lsp)) {
			throw new ConfigError(
				'Invalid "lsp" configuration. Optional fields: indexPath (string), provider ("lsif" | "scip")',
				configPath,
			);
		}
	}

	/**
	 * Validate input configuration
	 */
	private static validateInputConfig(input: any): boolean {
		if (!input || typeof input !== "object") {
			return false;
		}

		if (typeof input.root !== "string" || !input.root.trim()) {
			return false;
		}

		if (!Array.isArray(input.include) || input.include.length === 0) {
			return false;
		}

		// Validate that all include patterns are strings
		for (const pattern of input.include) {
			if (typeof pattern !== "string" || !pattern.trim()) {
				return false;
			}
		}

		// Validate exclude patterns if present
		if (input.exclude && !Array.isArray(input.exclude)) {
			return false;
		}

		// Validate language if present
		if (input.language && typeof input.language !== "string") {
			return false;
		}

		return true;
	}

	/**
	 * Validate output configuration
	 */
	private static validateOutputConfig(output: any): boolean {
		if (!output || typeof output !== "object") {
			return false;
		}

		if (typeof output.directory !== "string" || !output.directory.trim()) {
			return false;
		}

		// Validate optional baseUrl
		if (output.baseUrl && typeof output.baseUrl !== "string") {
			return false;
		}

		return true;
	}

	/**
	 * Validate LSP configuration
	 */
	private static validateLspConfig(lsp: any): boolean {
		if (!lsp || typeof lsp !== "object") {
			return false;
		}

		// Validate optional indexPath
		if (lsp.indexPath && typeof lsp.indexPath !== "string") {
			return false;
		}

		// Validate optional provider
		if (lsp.provider && !["lsif", "scip"].includes(lsp.provider)) {
			return false;
		}

		return true;
	}

	/**
	 * Get default configuration
	 */
	static getDefaultConfig(): CireConfig {
		return {
			name: "Cire Project",
			version: "1.0.0",
			description: "Static website generated with Cire",
			input: {
				root: "./src",
				include: ["**/*.ts"],
				exclude: ["**/*.test.ts", "**/*.spec.ts", "node_modules/**"],
				language: "typescript",
			},
			output: {
				directory: "./dist",
				baseUrl: "/",
			},
			lsp: {
				provider: "scip",
			},
			theme: {
				name: "default",
			},
		};
	}

	/**
	 * Create a sample .cire configuration file
	 */
	static createSampleConfig(configPath: string): void {
		const defaultConfig = ConfigLoader.getDefaultConfig();
		const configContent = JSON.stringify(defaultConfig, null, 2);

		try {
			require("fs").writeFileSync(configPath, configContent, "utf-8");
		} catch (error) {
			throw new ConfigError(
				`Failed to create sample configuration: ${error instanceof Error ? error.message : error}`,
				configPath,
			);
		}
	}
}
