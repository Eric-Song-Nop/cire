#!/usr/bin/env node

/**
 * Cire CLI - Command Line Interface for Cire Static Website Generator
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { HTMLGenerator } from "./generator/HTMLGenerator";
import { TSHighLighter } from "./highlighter/TSHighlighter";
import { MergeTokenPass, SortTokenPass } from "./passes";
import type { FileIR } from "./types";

const program = new Command();

program
	.name("cire")
	.description(
		"Static website generator providing IDE-like experiences for documentation",
	)
	.version("0.1.0");

program
	.command("highlight")
	.description(
		"Generate HTML documentation with syntax highlighting from a single source file",
	)
	.requiredOption("-i, --input <file>", "Input source code file")
	.option("-o, --output <file>", "Output HTML file (default: input.html)")
	.option(
		"-l, --language <lang>",
		"Language (default: typescript)",
		"typescript",
	)
	.option("-v, --verbose", "Enable verbose logging")
	.action(async (options) => {
		try {
			if (options.verbose) {
				console.log(
					chalk.blue.bold("🔍 Starting syntax highlighting pipeline"),
				);
			}

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

			if (options.verbose) {
				console.log(chalk.gray(`📁 Input: ${inputFile}`));
				console.log(chalk.gray(`📝 Output: ${outputFile}`));
			}

			// Create FileIR
			const fileIR: FileIR = {
				filePath: inputFile,
				language: options.language,
			};

			console.log(
				chalk.blue(
					`🔍 Analyzing syntax with ${options.language} highlighter...`,
				),
			);

			// Step 1: Generate syntax highlighting tokens
			console.log(
				chalk.blue(
					`🔍 Analyzing syntax with ${options.language} highlighter...`,
				),
			);
			const highlighter = new TSHighLighter(options.language);
			const rawTokens = highlighter.highlight(fileIR);

			if (options.verbose) {
				console.log(
					chalk.gray(
						`   Found ${rawTokens.length} raw syntax tokens`,
					),
				);
			} else {
				console.log(
					chalk.green(
						`✨ Found ${rawTokens.length} raw syntax tokens`,
					),
				);
			}

			// Step 2: Process tokens with TokenInfoPass pipeline
			console.log(chalk.blue(`🔄 Processing tokens with pipeline...`));
			const sortPass = new SortTokenPass();
			const mergePass = new MergeTokenPass();
			const processedTokens = mergePass.process(
				sortPass.process(rawTokens),
			);

			if (options.verbose) {
				console.log(
					chalk.gray(
						`   Processed into ${processedTokens.length} merged tokens`,
					),
				);
			} else {
				console.log(
					chalk.green(
						`✨ Processed into ${processedTokens.length} merged tokens`,
					),
				);
			}

			// Step 3: Generate HTML
			console.log(chalk.blue(`🎨 Generating HTML documentation...`));
			const generator = new HTMLGenerator();
			const html = generator.generate(fileIR, processedTokens);

			// Step 3: Write output file
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
