import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import type { CireConfig, FileIR } from "../types";
import { logger } from "../utils/logger";
import { type WorkflowConfig, WorkflowManager } from "./WorkflowManager";

export interface BuildStats {
	totalFiles: number;
	processedFiles: number;
	failedFiles: number;
	processingTime: number;
}

/**
 * ProjectBuilder - Handles project-level batch building.
 * Responsible for scanning source files, batch processing, and creating output directory structure.
 */
export class ProjectBuilder {
	private workflowManager: WorkflowManager | null = null;
	private cireConfig: CireConfig;

	constructor(config: CireConfig) {
		this.cireConfig = config;
	}

	/**
	 * Build the entire project
	 */
	async buildProject(): Promise<BuildStats> {
		const startTime = Date.now();

		try {
			// 1. Load configuration
			const config = this.cireConfig;

			if (config.logLevel === "info") {
				console.log(`📁 Loaded config for: ${config.name}`);
				console.log(`📂 Input root: ${config.input.root}`);
				console.log(`📤 Output directory: ${config.output.directory}`);
			}

			// 2. Scan source code files
			const sourceFiles = await this.scanSourceFiles(config);

			if (config.logLevel === "info") {
				console.log(`🔍 Found ${sourceFiles.length} source files`);
			}

			// 3. Create output directory
			const outputDir = config.output.directory;
			await this.ensureOutputDirectory(outputDir);

			// 4. Initialize WorkflowManager
			this.workflowManager = this.createWorkflowManager(config);

			// 5. Batch process files
			const stats = await this.processFiles(
				sourceFiles,
				outputDir,
				config,
			);

			// 6. Copy asset files
			await this.copyAssets(outputDir);

			const processingTime = Date.now() - startTime;

			return {
				...stats,
				processingTime,
			};
		} catch (error) {
			throw new Error(`Project build failed: ${error}`);
		}
	}

	/**
	 * Scan source code files
	 */
	private async scanSourceFiles(config: CireConfig): Promise<string[]> {
		const { root, include, exclude } = config.input;
		const sourceFiles: string[] = [];

		// Resolve absolute path
		const absoluteRoot = path.resolve(root);

		// Find files for each include pattern
		for (const pattern of include) {
			const fullPattern = path.join(absoluteRoot, pattern);

			if (this.cireConfig.description) {
				console.log(`🔍 Scanning pattern: ${fullPattern}`);
			}

			const files = await glob(fullPattern, {
				ignore: exclude?.map((exclude) =>
					path.join(absoluteRoot, exclude),
				),
				absolute: true,
			});

			sourceFiles.push(...files);
		}

		// Remove duplicates and sort
		return [...new Set(sourceFiles)].sort();
	}

	/**
	 * Ensure output directory exists
	 */
	private async ensureOutputDirectory(outputDir: string): Promise<void> {
		const absoluteOutputDir = path.resolve(outputDir);

		if (!fs.existsSync(absoluteOutputDir)) {
			fs.mkdirSync(absoluteOutputDir, { recursive: true });
			console.log(`📁 Created output directory: ${absoluteOutputDir}`);
		}
	}

	/**
	 * Create WorkflowManager
	 */
	private createWorkflowManager(config: CireConfig): WorkflowManager {
		const workflowConfig: WorkflowConfig = {
			syntaxHighlighting: true,
			hoverDocumentation: !!config.lsp?.indexPath,
			commentToMarkdown: true,
			scipIndexPath: config.lsp?.indexPath,
			language: config.input.language,
		};

		return new WorkflowManager(workflowConfig);
	}

	/**
	 * Batch process files
	 */
	private async processFiles(
		sourceFiles: string[],
		outputDir: string,
		config: CireConfig,
		verbose: boolean = false,
	): Promise<{
		processedFiles: number;
		failedFiles: number;
		totalFiles: number;
	}> {
		let processedFiles = 0;
		let failedFiles = 0;

		console.log(`🚀 Processing ${sourceFiles.length} files...`);

		for (const sourceFile of sourceFiles) {
			try {
				await this.processSingleFile(sourceFile, outputDir, config);
				processedFiles++;

				if (verbose) {
					console.log(
						`✅ Processed: ${path.relative(process.cwd(), sourceFile)}`,
					);
				} else if (
					processedFiles % 10 === 0 ||
					processedFiles === sourceFiles.length
				) {
					// Show progress every 10 files or when complete
					const progress = Math.round(
						(processedFiles / sourceFiles.length) * 100,
					);
					process.stdout.write(
						`\r⏳ Progress: ${progress}% (${processedFiles}/${sourceFiles.length})`,
					);
				}
			} catch (error) {
				failedFiles++;
				console.error(`\n❌ Failed to process ${sourceFile}:`, error);
			}
		}

		// Clear progress line
		if (!verbose) {
			process.stdout.write(`\r${" ".repeat(50)}\r`);
		}

		console.log(
			`\n✨ Processing complete: ${processedFiles} success, ${failedFiles} failed`,
		);

		return {
			processedFiles,
			failedFiles,
			totalFiles: sourceFiles.length,
		};
	}

	/**
	 * Process a single file
	 */
	private async processSingleFile(
		sourceFile: string,
		outputDir: string,
		config: CireConfig,
	): Promise<void> {
		if (!this.workflowManager) {
			throw new Error("WorkflowManager not initialized");
		}

		// Calculate relative path and create FileIR
		const projectRoot = config.input.root;
		const relativePath = path.relative(projectRoot, sourceFile);
		const fileIR: FileIR = {
			relativePath,
			language: config.input.language,
		};

		// Process file through WorkflowManager
		const html = this.workflowManager.processFile(fileIR, projectRoot);
		const outputPath = path.resolve(outputDir, relativePath);
		const htmlOutputPath = outputPath.replace(/\.[^.]+$/, ".html");

		// Ensure output file directory exists
		const outputDirPath = path.dirname(htmlOutputPath);
		if (!fs.existsSync(outputDirPath)) {
			fs.mkdirSync(outputDirPath, { recursive: true });
		}

		// Write HTML file
		fs.writeFileSync(htmlOutputPath, html, "utf-8");
	}

	/**
	 * Copy asset files (CSS, images, etc.)
	 */
	private async copyAssets(
		outputDir: string,
		verbose: boolean = false,
	): Promise<void> {
		const templateDir = path.resolve(__dirname, "../../templates");
		const cssSourcePath = path.join(templateDir, "default.css");
		const cssTargetPath = path.resolve(outputDir, "default.css");

		if (fs.existsSync(cssSourcePath)) {
			fs.copyFileSync(cssSourcePath, cssTargetPath);

			if (verbose) {
				console.log(`📋 Copied CSS to: ${cssTargetPath}`);
			}
		} else {
			console.warn(`!  CSS file not found: ${cssSourcePath}`);
		}
	}
}
