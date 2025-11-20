/**
 * # Core types for Cire static website generator
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
	logLevel: "info" | "warn" | "error" | "debug";
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
	// Template configuration
	template?: {
		layout?: string; // Layout template name ('default' | 'minimal')
		templateDir?: string; // Custom template directory path
		customCSS?: string; // Path to custom CSS file
	};
	// Output format configuration
	outputFormat?: {
		backend?: "html" | "markdown"; // Output format backend
	};
	// Feature flags
	features?: {
		syntaxHighlighting?: boolean; // Enable syntax highlighting
		hoverDocumentation?: boolean; // Enable hover documentation
		definitionJumping?: boolean; // Enable click-to-definition functionality
		commentMarkdown?: boolean; // Enable comment-to-markdown conversion
		navigationIndex?: boolean; // Enable navigation index generation
	};
}

// Intermediate representation for a file
export interface FileIR {
	// Relative path from project root
	relativePath: string;
	language: string;
}

export type MetaInfo =
	| { type: "highlight"; highlightClasses: string[] }
	| { type: "hover"; content: string; documentation?: string }
	| { type: "symbolDefinition"; symbolId: string; symbolName: string }
	| { type: "symbolReference"; symbolId: string; symbolName: string }
	| { type: "comment" }
	| { type: "plaintext" }
	| { type: "startOfLine" }
	| { type: "endOfLine" }
	| { type: "endOfFile" };

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

/**
 * # Interface for analyzer
 * Example analyzers: syntax highlighter, hover documentation extractor
 */
export interface Analyzer {
	analyze(fileIR: FileIR, projectRoot: string): TokenInfo[];
}

// Generator interface
export interface DocGenerator {
	generate(fileIR: FileIR, info: TokenInfo[], projectRoot: string): string;
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
