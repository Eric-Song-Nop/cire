import { CommentAnalyzer } from "../analyzer/CommentAnalyzer";
import { SCIPAnalyzer } from "../analyzer/SCIPAnalyzer";
import { TSHighLighter } from "../analyzer/TSHighlighter";
import { HTMLGenerator } from "../generator/HTMLGenerator";
import { MergeTokenPass, SortTokenPass } from "../passes";
import type { FileIR, TokenInfo } from "../types";

export interface WorkflowConfig {
	syntaxHighlighting: boolean;
	hoverDocumentation: boolean;
	commentToMarkdown: boolean;
	scipIndexPath?: string;
	language?: string;
}

export class WorkflowManager {
	private tsHighlighter: TSHighLighter;
	private scipAnalyzer: SCIPAnalyzer | null = null;
	private commentAnalyzer: CommentAnalyzer;
	private htmlGenerator: HTMLGenerator;
	private config: WorkflowConfig;

	constructor(config: WorkflowConfig) {
		this.config = config;
		this.tsHighlighter = new TSHighLighter(config.language);
		this.commentAnalyzer = new CommentAnalyzer();
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

		// Step 2: Extract comment tokens
		if (this.config.commentToMarkdown) {
			console.log("  → Extracting comment tokens...");
			const commentTokens = this.commentAnalyzer.analyze(fileIR);
			allTokens.push(...commentTokens);
			console.log(`    Found ${commentTokens.length} comment tokens`);
		}

		// Step 3: Extract hover documentation tokens
		if (this.config.hoverDocumentation && this.scipAnalyzer) {
			console.log("  → Extracting hover documentation tokens...");
			const hoverTokens = this.scipAnalyzer.analyze(fileIR);
			allTokens.push(...hoverTokens);
			console.log(`    Found ${hoverTokens.length} hover tokens`);
		}

		// Step 4: Merge and deduplicate tokens
		console.log("  → Merging and deduplicating tokens...");
		const mergedTokens = this.mergeTokens(allTokens);
		console.log(`    Final count: ${mergedTokens.length} unique tokens`);

		// Step 5: Generate HTML
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

		// Use professional passes instead of manual implementation
		const sortPass = new SortTokenPass();
		const mergePass = new MergeTokenPass();

		// First sort tokens, then merge overlapping ones
		const sortedTokens = sortPass.process(tokens);
		const mergedTokens = mergePass.process(sortedTokens);

		return mergedTokens;
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
