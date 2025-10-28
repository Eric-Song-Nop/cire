#!/usr/bin/env node

/**
 * Cire CLI - Command Line Interface for Cire Static Website Generator
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { type WorkflowConfig, WorkflowManager } from "./core/WorkflowManager";

const program = new Command();

program
	.name("cire")
	.description(
		"Static website generator providing IDE-like experiences for documentation",
	)
	.version("0.1.0");

// Default command - generate HTML with syntax highlighting and SCIP hover
program
	.requiredOption("-i, --input <file>", "Input source code file")
	.option("-o, --output <file>", "Output HTML file (default: input.html)")
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
			// Resolve input file path
			const inputFile = path.resolve(options.input);

			// Check if input file exists
			if (!fs.existsSync(inputFile)) {
				console.error(
					chalk.red.bold(`❌ Input file not found: ${inputFile}`),
				);
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
					chalk.red.bold(
						`❌ SCIP index file not found: ${options.scip}`,
					),
				);
				process.exit(1);
			}

			// Create workflow configuration
			const config: WorkflowConfig = {
				syntaxHighlighting: options.highlight,
				hoverDocumentation: options.hover && !!options.scip,
				commentToMarkdown: options.commentMarkdown,
				scipIndexPath: options.scip,
				language: options.language,
			};

			// Initialize workflow manager
			const workflow = new WorkflowManager(config);

			if (options.verbose) {
				console.log(
					chalk.blue.bold(
						"🚀 Starting Cire complete analysis pipeline",
					),
				);
				console.log(chalk.gray(`📁 Input: ${inputFile}`));
				console.log(chalk.gray(`📝 Output: ${outputFile}`));
				console.log(chalk.gray(`🔤 Language: ${options.language}`));
				console.log(
					chalk.gray(
						`✨ Syntax Highlighting: ${config.syntaxHighlighting}`,
					),
				);
				console.log(
					chalk.gray(
						`💬 Comment-to-Markdown: ${config.commentToMarkdown}`,
					),
				);
				console.log(
					chalk.gray(
						`🔍 Hover Documentation: ${config.hoverDocumentation}`,
					),
				);
				if (config.scipIndexPath) {
					console.log(
						chalk.gray(`📊 SCIP Index: ${config.scipIndexPath}`),
					);
				}

				const stats = workflow.getStats();
				console.log(
					chalk.gray(
						`🔧 TSHighlighter: ${stats.syntaxHighlighter ? "✓" : "✗"}`,
					),
				);
				console.log(
					chalk.gray(
						`🔧 SCIPAnalyzer: ${stats.scipAnalyzer ? "✓" : "✗"}`,
					),
				);
				console.log();
			}

			// Create FileIR
			const fileIR = {
				filePath: inputFile,
				language: options.language,
			};

			// Process file through workflow
			const html = workflow.processFile(fileIR);

			// Write output file
			console.log(chalk.blue(`💾 Writing HTML...`));
			fs.writeFileSync(outputFile, html);

			console.log(
				chalk.green.bold(`🎉 Successfully generated documentation!`),
			);
			console.log(
				chalk.cyan(
					`📁 Open ${outputFile} in your browser to view the result.`,
				),
			);

			// Show feature summary
			const stats = workflow.getStats();
			console.log();
			console.log(chalk.blue.bold("🎯 Features included:"));
			if (stats.syntaxHighlighter) {
				console.log(
					chalk.green(`  ✓ Syntax highlighting (Tree-sitter)`),
				);
			}
			if (config.commentToMarkdown) {
				console.log(
					chalk.green(`  ✓ Block comment to Markdown conversion`),
				);
			}
			if (stats.scipAnalyzer) {
				console.log(chalk.green(`  ✓ Hover documentation (SCIP)`));
			}
			console.log(chalk.green(`  ✓ Token processing pipeline`));
			console.log(chalk.green(`  ✓ Modern HTML output`));
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error:"),
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

program
	.command("build")
	.description("Build static website from source code")
	.option("-c, --config <path>", "Path to .cire configuration file", ".cire")
	.option("-o, --output <dir>", "Output directory for generated website")
	.option("-w, --watch", "Watch for changes and rebuild automatically")
	.option("-v, --verbose", "Enable verbose logging")
	.action(async (options) => {
		try {
			console.log(chalk.blue.bold("🔨 Cire Build Started"));

			if (options.verbose) {
				console.log(chalk.gray(`Using config: ${options.config}`));
			}

			// TODO: Load config and run generation
			console.log(
				chalk.yellow(
					"⚠️  Build functionality not yet implemented - Phase 1 setup only",
				),
			);

			console.log(chalk.green.bold("✨ Done!"));
		} catch (error) {
			console.error(
				chalk.red.bold("❌ Error:"),
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

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
