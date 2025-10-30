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
	 * 构建整个项目
	 */
	async buildProject(): Promise<BuildStats> {
		const startTime = Date.now();

		try {
			// 1. 加载配置
			const config = this.cireConfig;

			if (config.logLevel === "info") {
				console.log(`📁 Loaded config for: ${config.name}`);
				console.log(`📂 Input root: ${config.input.root}`);
				console.log(`📤 Output directory: ${config.output.directory}`);
			}

			// 2. 扫描源代码文件
			const sourceFiles = await this.scanSourceFiles(config);

			if (config.logLevel === "info") {
				console.log(`🔍 Found ${sourceFiles.length} source files`);
			}

			// 3. 创建输出目录
			const outputDir = config.output.directory;
			await this.ensureOutputDirectory(outputDir);

			// 4. 初始化 WorkflowManager
			this.workflowManager = this.createWorkflowManager(config);

			// 5. 批量处理文件
			const stats = await this.processFiles(
				sourceFiles,
				outputDir,
				config,
			);

			// 6. 复制资源文件
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
	 * 扫描源代码文件
	 */
	private async scanSourceFiles(config: CireConfig): Promise<string[]> {
		const { root, include, exclude } = config.input;
		const sourceFiles: string[] = [];

		// 解析绝对路径
		const absoluteRoot = path.resolve(root);

		// 为每个 include 模式查找文件
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

		// 去重并排序
		return [...new Set(sourceFiles)].sort();
	}

	/**
	 * 确保输出目录存在
	 */
	private async ensureOutputDirectory(outputDir: string): Promise<void> {
		const absoluteOutputDir = path.resolve(outputDir);

		if (!fs.existsSync(absoluteOutputDir)) {
			fs.mkdirSync(absoluteOutputDir, { recursive: true });
			console.log(`📁 Created output directory: ${absoluteOutputDir}`);
		}
	}

	/**
	 * 创建 WorkflowManager
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
	 * 批量处理文件
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
					// 每处理10个文件或处理完成时显示进度
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

		// 清除进度行
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
	 * 处理单个文件
	 */
	private async processSingleFile(
		sourceFile: string,
		outputDir: string,
		config: CireConfig,
	): Promise<void> {
		if (!this.workflowManager) {
			throw new Error("WorkflowManager not initialized");
		}

		// 创建 FileIR
		const fileIR: FileIR = {
			filePath: sourceFile,
			language: config.input.language,
		};

		// 通过 WorkflowManager 处理文件
		const html = this.workflowManager.processFile(fileIR);

		// 计算输出文件路径，保持目录结构
		const relativePath = path.relative(
			path.resolve(config.input.root),
			sourceFile,
		);
		const outputPath = path.resolve(outputDir, relativePath);
		const htmlOutputPath = outputPath.replace(/\.[^.]+$/, ".html");

		// 确保输出文件的目录存在
		const outputDirPath = path.dirname(htmlOutputPath);
		if (!fs.existsSync(outputDirPath)) {
			fs.mkdirSync(outputDirPath, { recursive: true });
		}

		// 写入 HTML 文件
		fs.writeFileSync(htmlOutputPath, html, "utf-8");
	}

	/**
	 * 复制资源文件（CSS、图片等）
	 */
	private async copyAssets(
		outputDir: string,
		verbose: boolean = false,
	): Promise<void> {
		const templateDir = path.resolve("templates");
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
