#!/usr/bin/env node

/**
 * Cire CLI - Command Line Interface for Cire Static Website Generator
 */
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { ConfigLoader } from "./config/config-loader";
import { ProjectBuilder } from "./core/ProjectBuilder";
import { WorkflowManager } from "./core/WorkflowManager";
import type { CireConfig } from "./types";
import { logger } from "./utils/logger";

/**
 * CLI options interface for type safety
 */
interface CLIOptions {
	input?: string;
	output?: string;
	config?: string;
	scip?: string;
	language?: string;
	highlight?: boolean;
	hover?: boolean;
	commentMarkdown?: boolean;
	verbose?: boolean;
}

const program = new Command();

program
	.name("cire")
	.description(
		"Static website generator providing IDE-like experiences for documentation",
	)
	.version("0.1.0");

// Smart mode - auto-detect single file vs project mode
program
	.option("-i, --input <file>", "Input source code file (single file mode)")
	.option(
		"-o, --output <file|dir>",
		"Output file (single file) or directory (project mode)",
	)
	.option(
		"-c, --config <path>",
		"Path to .cire configuration file (project mode)",
	)
	.option("-s, --scip <path>", "SCIP index file path for hover documentation")
	.option(
		"-l, --language <lang>",
		"Language (default: typescript)",
		"typescript",
	)
	.option("--no-highlight", "Disable syntax highlighting")
	.option("--no-hover", "Disable hover documentation")
	.option("--no-comment-markdown", "Disable comment-to-markdown conversion")
	.option("-v, --verbose", "Enable verbose logging")
	.action(async (options) => {
		try {
			// Smart mode detection
			if (options.config) {
				// Project mode explicitly requested
				const config = await new ConfigLoader().loadConfig(
					options.config,
				);
				logger.setLevel(config.logLevel);
				await runProjectMode(config);
				return;
			}

			if (options.input) {
				// Single file mode explicitly requested
				await runSingleFileMode(options);
				return;
			}

			// Auto-detection mode
			await autoDetectAndRun(options);
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error:"),
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

/**
 * Run in project mode using ProjectBuilder
 */
async function runProjectMode(config: CireConfig): Promise<void> {
	console.log(chalk.blue.bold("🔨 Cire Project Mode Started"));

	const builder = new ProjectBuilder(config);

	if (config.logLevel === "debug") {
		console.log(chalk.gray(`Using config: ${config}`));
	}

	const stats = await builder.buildProject();

	// Show results
	console.log();
	console.log(chalk.green.bold("🎉 Build completed successfully!"));
	console.log(chalk.cyan(`📊 Processed ${stats.processedFiles} files`));

	if (stats.failedFiles > 0) {
		console.log(
			chalk.yellow(`!  ${stats.failedFiles} files failed to process`),
		);
	}

	console.log(
		chalk.cyan(
			`⏱  Processing time: ${(stats.processingTime / 1000).toFixed(2)}s`,
		),
	);
	console.log(chalk.cyan(`📁 Total files found: ${stats.totalFiles}`));

	const outputDir = config.output.directory;
	console.log();
	console.log(chalk.blue.bold("📂 Output directory:"));
	console.log(chalk.cyan(`   ${path.resolve(outputDir)}`));
}

/**
 * Run in single file mode using WorkflowManager
 */
async function runSingleFileMode(options: CLIOptions): Promise<void> {
	// Resolve input file path
	if (!options.input) {
		console.error(
			chalk.red.bold("❌ Input file is required for single file mode"),
		);
		process.exit(1);
	}
	const inputFile = path.resolve(options.input);

	// Check if input file exists
	if (!fs.existsSync(inputFile)) {
		console.error(chalk.red.bold(`❌ Input file not found: ${inputFile}`));
		process.exit(1);
	}

	// Determine output file path
	const outputFile = options.output
		? path.resolve(options.output)
		: path.resolve(
				path.dirname(inputFile),
				`${path.basename(inputFile, path.extname(inputFile))}.html`,
			);

	// Validate SCIP index if hover is enabled
	if (options.hover && options.scip && !fs.existsSync(options.scip)) {
		console.error(
			chalk.red.bold(`❌ SCIP index file not found: ${options.scip}`),
		);
		process.exit(1);
	}

	// Create complete CireConfig for single file mode
	const cireConfig: CireConfig = {
		name: "Cire Single File",
		version: "1.0.0",
		description: "Single file processing",
		logLevel: options.verbose ? "info" : "error",
		input: {
			root: path.dirname(inputFile),
			include: [path.basename(inputFile)],
			language: options.language || "typescript",
		},
		output: {
			directory: path.dirname(outputFile),
		},
		lsp: {
			indexPath: options.scip,
		},
		features: {
			syntaxHighlighting: options.highlight,
			hoverDocumentation: options.hover && !!options.scip,
			definitionJumping: !!options.scip,
			commentMarkdown: options.commentMarkdown,
		},
		template: {
			layout: "default",
		},
	};

	// Initialize workflow manager with complete config
	const workflow = new WorkflowManager(cireConfig);

	if (options.verbose) {
		console.log(
			chalk.blue.bold("🚀 Starting Cire single file analysis pipeline"),
		);
		console.log(chalk.gray(`📁 Input: ${inputFile}`));
		console.log(chalk.gray(`📝 Output: ${outputFile}`));
		console.log(chalk.gray(`🔤 Language: ${options.language}`));
		console.log(
			chalk.gray(
				`✨ Syntax Highlighting: ${cireConfig.features?.syntaxHighlighting}`,
			),
		);
		console.log(
			chalk.gray(
				`💬 Comment-to-Markdown: ${cireConfig.features?.commentMarkdown}`,
			),
		);
		console.log(
			chalk.gray(
				`🔍 Hover Documentation: ${cireConfig.features?.hoverDocumentation}`,
			),
		);
		console.log(
			chalk.gray(
				`🔗 Definition Jumping: ${cireConfig.features?.definitionJumping}`,
			),
		);
		if (cireConfig.lsp?.indexPath) {
			console.log(
				chalk.gray(`📊 SCIP Index: ${cireConfig.lsp?.indexPath}`),
			);
		}

		const stats = workflow.getStats();
		console.log(
			chalk.gray(
				`🔧 TSHighlighter: ${stats.syntaxHighlighter ? "✓" : "✗"}`,
			),
		);
		console.log(
			chalk.gray(`🔧 SCIPAnalyzer: ${stats.scipAnalyzer ? "✓" : "✗"}`),
		);
		console.log();
	}

	// Create FileIR with relative path (for single file, just the filename)
	const fileIR = {
		relativePath: path.basename(inputFile),
		language: options.language || "typescript",
	};

	// For single file mode, use input file's directory as projectRoot
	const projectRoot = path.dirname(inputFile);

	// Process file through workflow
	const html = workflow.processFile(fileIR, projectRoot);

	// Write output file
	console.log(chalk.blue(`💾 Writing HTML...`));
	fs.writeFileSync(outputFile, html);

	console.log(chalk.green.bold(`🎉 Successfully generated documentation!`));
	console.log(
		chalk.cyan(`📁 Open ${outputFile} in your browser to view the result.`),
	);

	// Show feature summary
	const stats = workflow.getStats();
	console.log();
	console.log(chalk.blue.bold("🎯 Features included:"));
	if (stats.syntaxHighlighter) {
		console.log(chalk.green(`  ✓ Syntax highlighting (Tree-sitter)`));
	}
	if (cireConfig.features?.commentMarkdown) {
		console.log(chalk.green(`  ✓ Block comment to Markdown conversion`));
	}
	if (cireConfig.features?.hoverDocumentation) {
		console.log(chalk.green(`  ✓ Hover documentation (SCIP)`));
	}
	if (cireConfig.features?.definitionJumping) {
		console.log(chalk.green(`  ✓ Definition jumping (SCIP)`));
	}
	console.log(chalk.green(`  ✓ Token processing pipeline`));
	console.log(chalk.green(`  ✓ Modern HTML output`));
}

/**
 * Auto-detect mode and run appropriate handler
 */
async function autoDetectAndRun(options: CLIOptions): Promise<void> {
	// Check for common config files
	const configFiles = [
		options.config || ".cire.json5",
		".cire",
		".cire.json",
		"cire.json5",
		"cire.json",
	];

	for (const configFile of configFiles) {
		if (fs.existsSync(configFile)) {
			if (options.verbose) {
				console.log(chalk.gray(`🔍 Found config file: ${configFile}`));
				console.log(chalk.blue("🏗  Switching to project mode..."));
			}
			const config = await new ConfigLoader().loadConfig(configFile);
			logger.setLevel(config.logLevel);
			await runProjectMode(config);
			return;
		}
	}

	// No config found, show error
	console.error(
		chalk.red.bold("❌ No configuration found and no input file specified"),
	);
	console.error();
	console.error(chalk.cyan("Usage options:"));
	console.error(chalk.cyan("  Single file mode:  cire -i <source-file>"));
	console.error(chalk.cyan("  Project mode:     cire -c <config-file>"));
	console.error(
		chalk.cyan("  Auto-detect:      cire (when .cire.json5 exists)"),
	);
	console.error();
	console.error(
		chalk.gray("Create a .cire.json5 file to enable project mode"),
	);
	process.exit(1);
}

// Parse command line arguments
program.parse();

// Handle unknown commands
program.on("command:*", () => {
	console.error(
		chalk.red.bold("❌ Invalid command:"),
		program.args.join(" "),
	);
	console.log("See --help for a list of available commands.");
	process.exit(1);
});
