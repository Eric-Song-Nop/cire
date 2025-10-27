/**
 * Core types for Cire static website generator
 */

// Text span representing a range in source code
export interface TextSpan {
	start: Position;
	end: Position;
}

// Position in source file (0-based)
export interface Position {
	line: number; // 0-based line number
	column: number; // 0-based column number
}

// Configuration file structure (.cire files)
export interface CireConfig {
	name: string;
	version: string;
	description?: string;
	input: {
		root: string;
		include: string[];
		exclude?: string[];
		language: string;
	};
	output: {
		directory: string;
		baseUrl?: string;
	};
	lsp?: {
		indexPath?: string; // Path to LSIF/SCIP index file
		provider?: "lsif" | "scip";
	};
	theme?: {
		name?: string;
		customCss?: string[];
	};
}

// Intermediate representation for a file
export interface FileIR {
	filePath: string;
	language: string;
}

type MetaInfo =
	| { type: "highlight"; highlightClasses: string[] }
	| { type: "hover"; content: string; documentation?: string }
	| { type: "definition"; filePath: string; pos: Position };

export type TokenInfo = {
	meta: MetaInfo[];
	span: TextSpan;
};

// Generated HTML page
export interface GeneratedPage {
	filePath: string;
	title: string;
	content: string;
	metadata: PageMetadata;
}

// Page metadata
export interface PageMetadata {
	language: string;
	lastModified: Date;
	functions: number;
	classes: number;
	linesOfCode: number;
}

export type ColorScheme = {
	TokenType: string;
	Style: string[];
};

export interface HighLighter {
	highlight(fileIR: FileIR): TokenInfo[];
}

// Generator interface
export interface DocGenerator {
	generate(fileIR: FileIR, info: TokenInfo[]): string;
}

// CLI options
export interface CLIOptions {
	input?: string;
	output?: string;
	config?: string;
	watch?: boolean;
	verbose?: boolean;
}

// Error types
export class CireError extends Error {
	constructor(
		message: string,
		public code: string,
		public filePath?: string,
		public line?: number,
	) {
		super(message);
		this.name = "CireError";
	}
}

export class ConfigError extends CireError {
	constructor(message: string, filePath?: string) {
		super(message, "CONFIG_ERROR", filePath);
		this.name = "ConfigError";
	}
}

export class ParseError extends CireError {
	constructor(message: string, filePath?: string, line?: number) {
		super(message, "PARSE_ERROR", filePath, line);
		this.name = "ParseError";
	}
}

export class GenerationError extends CireError {
	constructor(message: string, filePath?: string) {
		super(message, "GENERATION_ERROR", filePath);
		this.name = "GenerationError";
	}
}
