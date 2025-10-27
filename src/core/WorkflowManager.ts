import { SCIPAnalyzer } from "../analyzer/SCIPAnalyzer";
import { TSHighLighter } from "../analyzer/TSHighlighter";
import { HTMLGenerator } from "../generator/HTMLGenerator";
import type { FileIR, TokenInfo } from "../types";

export interface WorkflowConfig {
	syntaxHighlighting: boolean;
	hoverDocumentation: boolean;
	scipIndexPath?: string;
	language?: string;
}

export class WorkflowManager {
	private tsHighlighter: TSHighLighter;
	private scipAnalyzer: SCIPAnalyzer | null = null;
	private htmlGenerator: HTMLGenerator;
	private config: WorkflowConfig;

	constructor(config: WorkflowConfig) {
		this.config = config;
		this.tsHighlighter = new TSHighLighter(config.language);
		this.htmlGenerator = new HTMLGenerator();

		// Initialize SCIP analyzer if hover documentation is enabled and path is provided
		if (config.hoverDocumentation && config.scipIndexPath) {
			this.scipAnalyzer = new SCIPAnalyzer(config.scipIndexPath);
		}
	}

	/**
	 * Process a file through the complete workflow
	 */
	processFile(fileIR: FileIR): string {
		console.log(`Processing file: ${fileIR.filePath}`);

		// Step 1: Extract syntax highlighting tokens
		const allTokens: TokenInfo[] = [];

		if (this.config.syntaxHighlighting) {
			console.log("  → Extracting syntax highlighting tokens...");
			const highlightTokens = this.tsHighlighter.analyze(fileIR);
			allTokens.push(...highlightTokens);
			console.log(`    Found ${highlightTokens.length} syntax tokens`);
		}

		// Step 2: Extract hover documentation tokens
		if (this.config.hoverDocumentation && this.scipAnalyzer) {
			console.log("  → Extracting hover documentation tokens...");
			const hoverTokens = this.scipAnalyzer.analyze(fileIR);
			allTokens.push(...hoverTokens);
			console.log(`    Found ${hoverTokens.length} hover tokens`);
		}

		// Step 3: Merge and deduplicate tokens
		console.log("  → Merging and deduplicating tokens...");
		const mergedTokens = this.mergeTokens(allTokens);
		console.log(`    Final count: ${mergedTokens.length} unique tokens`);

		// Step 4: Generate HTML
		console.log("  → Generating HTML...");
		const html = this.htmlGenerator.generate(fileIR, mergedTokens);
		console.log("  → HTML generation complete!");

		return html;
	}

	/**
	 * Merge tokens from multiple analyzers and resolve overlaps
	 */
	private mergeTokens(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		// Sort tokens by start position
		const sortedTokens = tokens.sort((a, b) => {
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}
			return a.span.start.column - b.span.start.column;
		});

		const mergedTokens: TokenInfo[] = [];

		for (const token of sortedTokens) {
			// Check for overlap with existing tokens
			const existingIndex = mergedTokens.findIndex((existing) =>
				this.tokensOverlap(existing.span, token.span),
			);

			if (existingIndex >= 0) {
				// Merge with existing token
				const existing = mergedTokens[existingIndex];
				const mergedMeta = this.mergeTokenMeta(
					existing.meta,
					token.meta,
				);
				mergedTokens[existingIndex] = {
					span: existing.span,
					meta: mergedMeta,
				};
			} else {
				// Add new token
				mergedTokens.push(token);
			}
		}

		return mergedTokens;
	}

	/**
	 * Check if two token spans overlap
	 */
	private tokensOverlap(
		span1: { start: any; end: any },
		span2: { start: any; end: any },
	): boolean {
		// Convert spans to comparable values (line * 1000 + column for simplicity)
		const start1 = span1.start.line * 1000 + span1.start.column;
		const end1 = span1.end.line * 1000 + span1.end.column;
		const start2 = span2.start.line * 1000 + span2.start.column;
		const end2 = span2.end.line * 1000 + span2.end.column;

		return !(end1 < start2 || end2 < start1);
	}

	/**
	 * Merge token metadata, avoiding duplicates
	 */
	private mergeTokenMeta(meta1: any[], meta2: any[]): any[] {
		const merged = [...meta1];

		for (const meta of meta2) {
			// Check if this meta type already exists
			const existingIndex = merged.findIndex(
				(existing) =>
					existing.type === meta.type &&
					JSON.stringify(existing) === JSON.stringify(meta),
			);

			if (existingIndex < 0) {
				merged.push(meta);
			}
		}

		return merged;
	}

	/**
	 * Get workflow statistics
	 */
	getStats(): { syntaxHighlighter: boolean; scipAnalyzer: boolean } {
		return {
			syntaxHighlighter: !!this.config.syntaxHighlighting,
			scipAnalyzer: !!this.scipAnalyzer,
		};
	}
}
