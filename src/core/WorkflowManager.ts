import { CommentAnalyzer } from "../analyzer/CommentAnalyzer";
import { SCIPAnalyzer } from "../analyzer/SCIPAnalyzer";
import { TSHighLighter } from "../analyzer/TSHighlighter";
import { HTMLGenerator } from "../generator/HTMLGenerator";
import { CommentMergePass, MergeTokenPass, SortTokenPass } from "../passes";
import type { CireConfig, FileIR, TokenInfo } from "../types";

export interface WorkflowConfig {
	syntaxHighlighting: boolean;
	hoverDocumentation: boolean;
	definitionJumping: boolean;
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

	constructor(config: WorkflowConfig, cireConfig?: CireConfig) {
		this.config = config;
		this.tsHighlighter = new TSHighLighter(config.language);
		this.commentAnalyzer = new CommentAnalyzer();

		// Create a default config if none provided
		const defaultCireConfig: CireConfig = {
			name: "Cire Project",
			version: "1.0.0",
			description: "Static website generated with Cire",
			logLevel: "error",
			input: {
				root: "src",
				include: ["**/*.ts"],
				language: "typescript",
			},
			output: {
				directory: "dist",
			},
			template: {
				layout: "default",
				theme: "light",
			},
			features: {
				syntaxHighlighting: config.syntaxHighlighting,
				hoverDocumentation: config.hoverDocumentation,
				definitionJumping: true, // 默认启用，但会被 cireConfig 覆盖
				commentMarkdown: config.commentToMarkdown,
				navigationIndex: false,
			},
		};

		this.htmlGenerator = new HTMLGenerator(cireConfig || defaultCireConfig);

		// Initialize SCIP analyzer if either hover documentation or definition jumping is enabled and path is provided
		// Note: SCIPAnalyzer provides both hover documentation AND definition jumping functionality
		if (
			(config.hoverDocumentation || config.definitionJumping) &&
			config.scipIndexPath
		) {
			this.scipAnalyzer = new SCIPAnalyzer(config.scipIndexPath);
		}
	}

	/**
	 * Process a file through the complete workflow
	 */
	processFile(fileIR: FileIR, projectRoot: string): string {
		console.log(`Processing file: ${fileIR.relativePath}`);

		// Step 1: Extract syntax highlighting tokens
		const allTokens: TokenInfo[] = [];

		if (this.config.syntaxHighlighting) {
			console.log("  → Extracting syntax highlighting tokens...");
			const highlightTokens = this.tsHighlighter.analyze(
				fileIR,
				projectRoot,
			);
			allTokens.push(...highlightTokens);
			console.log(`    Found ${highlightTokens.length} syntax tokens`);
		}

		// Step 2: Extract comment tokens
		if (this.config.commentToMarkdown) {
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
			(this.config.hoverDocumentation || this.config.definitionJumping) &&
			this.scipAnalyzer
		) {
			const scipTokens = this.scipAnalyzer.analyze(fileIR, projectRoot);
			allTokens.push(...scipTokens);
		}

		// Step 4: Merge and deduplicate tokens
		console.log("  → Merging and deduplicating tokens...");
		const mergedTokens = this.mergeTokens(allTokens);
		console.log(`    Final count: ${mergedTokens.length} unique tokens`);

		// Step 5: Generate HTML
		console.log("  → Generating HTML...");
		const html = this.htmlGenerator.generate(
			fileIR,
			mergedTokens,
			projectRoot,
		);
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
		const commentMergePass = new CommentMergePass();

		// Process tokens through the pipeline: sort → merge → comment merge
		const sortedTokens = sortPass.process(tokens);
		const mergedTokens = mergePass.process(sortedTokens);
		const finalTokens = commentMergePass.process(mergedTokens);

		return finalTokens;
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
