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

// Highlight information
export interface HighlightInfo {
	highlightClasses: string[];
}

// LSP hover information
export interface HoverInfo {
	content: string;
	documentation?: string;
}

// Definition location for goto definition
export interface DefinitionLocation {
	filePath: string;
    pos: Position;
}

export type TokenInfo = {
	meta: (HighlightInfo | HoverInfo | DefinitionLocation)[];
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
}

export interface HighLighter {
    highlight(fileIR: FileIR): TokenInfo[]
}

// Generator interface
export interface Generator {
	generate(fileIR: FileIR[]): Promise<GeneratedPage[]>;
}

// LSP Provider interface
export interface LSPProvider {
	loadIndex(indexPath: string): Promise<void>;
	getHover(
		filePath: string,
		position: { line: number; column: number },
	): Promise<HoverInfo | null>;
	getDefinition(
		filePath: string,
		position: { line: number; column: number },
	): Promise<DefinitionLocation | null>;
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
