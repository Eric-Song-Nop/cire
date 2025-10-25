/**
 * Cire - Static Website Generator with IDE-like Experiences
 * Main entry point for the library
 */

export { CireError, ConfigError, ParseError, GenerationError } from "./types";
export type {
	CireConfig,
	FileIR,
	ParsedComment,
	ParsedCode,
	HoverInfo,
	DefinitionLocation,
	GeneratedPage,
	Generator,
	LSPProvider,
	CLIOptions,
} from "./types";

// Re-export CireConfig as a value for use in the class
import type { CireConfig as CireConfigType } from "./types";
type CireConfig = CireConfigType;

// Main Cire class
export class Cire {
	private config: CireConfig;

	constructor(config: CireConfig) {
		this.config = config;
	}

	/**
	 * Generate static website from source code
	 */
	async generate(): Promise<void> {
		console.log(`🚀 Starting Cire generation for ${this.config.name}...`);

		// TODO: Implementation will be added in subsequent phases
		throw new Error("Not implemented yet - this is Phase 1 setup");
	}

	/**
	 * Get current configuration
	 */
	getConfig(): CireConfig {
		return { ...this.config };
	}
}

// Factory function to create Cire instance from config file
export async function createCire(configPath: string): Promise<Cire> {
	// TODO: Load config from file
	throw new Error("Not implemented yet - this is Phase 1 setup");
}
