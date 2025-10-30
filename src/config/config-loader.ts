/**
 * Configuration loader for .cire files
 * Supports both JSON (.cire) and JSON5 (.cire.json5) formats
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSON5 from "json5";
import { type CireConfig, ConfigError } from "../types";

export class ConfigLoader {
	public verbose: boolean = false;
	private defaultConfig: CireConfig = {
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
		logLevel: "error",
		lsp: {
			provider: "scip",
		},
	};
	/**
	 * Load configuration from a .cire file and merge with defaults
	 * Supports both JSON (.cire) and JSON5 (.cire.json5) formats
	 */
	async loadConfig(configPath?: string): Promise<CireConfig> {
		// If no config path provided, return default config
		if (!configPath) {
			if (this.verbose) {
				console.log(
					"📄 No config file specified, using default configuration",
				);
			}
			return this.defaultConfig;
		}

		const fullPath = resolve(process.cwd(), configPath);

		// If config file doesn't exist, return default config
		if (!existsSync(fullPath)) {
			if (this.verbose) {
				console.log(
					`📄 Config file not found: ${configPath}, using defaults`,
				);
			}
			return this.defaultConfig;
		}

		try {
			const configContent = readFileSync(fullPath, "utf-8");

			// Parse user configuration
			const userConfig: CireConfig = JSON5.parse(
				configContent,
			) as CireConfig;

			if (this.verbose) {
				console.log(`📄 Loaded config from: ${fullPath}`);
			}

			// Basic validation
			this.validateConfig(userConfig, fullPath);

			// Merge user config with defaults
			return this.mergeConfigs(this.defaultConfig, userConfig);
		} catch (error) {
			if (error instanceof ConfigError) {
				throw error;
			}

			if (error instanceof SyntaxError) {
				throw new ConfigError(
					`Invalid JSON5 in configuration file: ${error.message}`,
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
	 * Simple merge user configuration with default configuration
	 */
	private mergeConfigs(
		defaultConfig: CireConfig,
		userConfig: Partial<CireConfig>,
	): CireConfig {
		return {
			...defaultConfig,
			...userConfig,
			input: {
				...defaultConfig.input,
				...userConfig.input,
			},
			output: {
				...defaultConfig.output,
				...userConfig.output,
			},
			lsp: userConfig.lsp
				? {
						...defaultConfig.lsp,
						...userConfig.lsp,
					}
				: defaultConfig.lsp,
		};
	}

	/**
	 * Basic configuration validation - TypeScript handles most type checking
	 */
	private validateConfig(config: CireConfig, configPath: string): void {
		// Only check for basic existence since TypeScript handles type safety
		if (!config) {
			throw new ConfigError(
				"Configuration is empty or invalid",
				configPath,
			);
		}

		// Basic sanity checks for critical fields
		if (!config.name?.trim()) {
			throw new ConfigError(
				'Configuration must have a non-empty "name" field',
				configPath,
			);
		}

		if (!config.input?.root?.trim()) {
			throw new ConfigError(
				'Configuration must have a non-empty "input.root" field',
				configPath,
			);
		}

		if (!config.output?.directory?.trim()) {
			throw new ConfigError(
				'Configuration must have a non-empty "output.directory" field',
				configPath,
			);
		}
	}

	/**
	 * Create a sample .cire configuration file
	 */
	createSampleConfig(configPath: string): void {
		const configContent = JSON.stringify(this.defaultConfig, null, 2);

		try {
			require("node:fs").writeFileSync(
				configPath,
				configContent,
				"utf-8",
			);
		} catch (error) {
			throw new ConfigError(
				`Failed to create sample configuration: ${error instanceof Error ? error.message : error}`,
				configPath,
			);
		}
	}
}
