import { CommentAnalyzer } from "../analyzer/CommentAnalyzer";
import { SCIPAnalyzer } from "../analyzer/SCIPAnalyzer";
import { TSHighLighter } from "../analyzer/TSHighlighter";
import { HTMLGenerator } from "../generator/HTMLGenerator";
import { MarkdownGenerator } from "../generator/MarkdownGenerator";
import {
	CommentMergePass,
	FillPlaintextPass,
	MergeTokenPass,
	SortTokenPass,
} from "../passes";
import type { CireConfig, DocGenerator, FileIR, TokenInfo } from "../types";

export class WorkflowManager {
	private tsHighlighter: TSHighLighter;
	private scipAnalyzer: SCIPAnalyzer | null = null;
	private commentAnalyzer: CommentAnalyzer;
	private generator: DocGenerator;
	private config: CireConfig;

	constructor(config: CireConfig) {
		this.config = config;

		// Initialize components
		this.tsHighlighter = new TSHighLighter(config.input.language);
		this.commentAnalyzer = new CommentAnalyzer();

		// Initialize generator based on output format
		const backend = config.outputFormat?.backend || "html";
		if (backend === "markdown") {
			this.generator = new MarkdownGenerator(config);
		} else {
			this.generator = new HTMLGenerator(config);
		}

		// Initialize SCIP analyzer if SCIP index path is provided
		// Note: SCIPAnalyzer provides both hover documentation AND definition jumping functionality
		if (config.lsp?.indexPath) {
			this.scipAnalyzer = new SCIPAnalyzer(config.lsp.indexPath);
		}
	}

	/**
	 * Process a file through the complete workflow
	 */
	processFile(fileIR: FileIR, projectRoot: string): string {
		console.log(`Processing file: ${fileIR.relativePath}`);

		// Step 1: Extract syntax highlighting tokens
		const allTokens: TokenInfo[] = [];

		if (this.config.features?.syntaxHighlighting ?? true) {
			console.log("  → Extracting syntax highlighting tokens...");
			const highlightTokens = this.tsHighlighter.analyze(
				fileIR,
				projectRoot,
			);
			allTokens.push(...highlightTokens);
			console.log(`    Found ${highlightTokens.length} syntax tokens`);
		}

		// Step 2: Extract comment tokens
		if (this.config.features?.commentMarkdown ?? true) {
			console.log("  → Extracting comment tokens...");
			const commentTokens = this.commentAnalyzer.analyze(
				fileIR,
				projectRoot,
			);
			allTokens.push(...commentTokens);
			console.log(`    Found ${commentTokens.length} comment tokens`);
		}

		// Step 3: Extract definition and hover documentation tokens from SCIP
		if (
			((this.config.features?.hoverDocumentation ?? false) ||
				(this.config.features?.definitionJumping ?? false)) &&
			this.scipAnalyzer
		) {
			const scipTokens = this.scipAnalyzer.analyze(fileIR, projectRoot);
			allTokens.push(...scipTokens);
		}

		// Step 4: Merge and deduplicate tokens
		console.log("  → Merging and deduplicating tokens...");
		const mergedTokens = this.mergeTokens(allTokens);
		console.log(`    Final count: ${mergedTokens.length} unique tokens`);

		// Step 5: Generate output
		const backend = this.config.outputFormat?.backend || "html";
		console.log(`  → Generating ${backend.toUpperCase()}...`);
		const output = this.generator.generate(
			fileIR,
			mergedTokens,
			projectRoot,
		);
		console.log(`  → ${backend.toUpperCase()} generation complete!`);

		return output;
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
		const commentMergePass = new CommentMergePass();
		const fillPlaintextPass = new FillPlaintextPass();

		// Process tokens through the pipeline: sort → merge → comment merge → fill plaintext
		const sortedTokens = sortPass.process(tokens);
		const mergedTokens = mergePass.process(sortedTokens);
		const commentMergedTokens = commentMergePass.process(mergedTokens);
		const finalTokens = fillPlaintextPass.process(commentMergedTokens);

		return finalTokens;
	}

	/**
	 * Get workflow statistics
	 */
	getStats(): { syntaxHighlighter: boolean; scipAnalyzer: boolean } {
		return {
			syntaxHighlighter: !!(
				this.config.features?.syntaxHighlighting ?? true
			),
			scipAnalyzer: !!this.scipAnalyzer,
		};
	}
}
