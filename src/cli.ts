#!/usr/bin/env node

/**
 * Cire CLI - Command Line Interface for Cire Static Website Generator
 */

import { Command } from "commander";
import chalk from "chalk";
import { Cire, createCire } from "./index";

const program = new Command();

program
	.name("cire")
	.description(
		"Static website generator providing IDE-like experiences for documentation",
	)
	.version("0.1.0");

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
