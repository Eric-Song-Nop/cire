import fs from "node:fs";
import * as path from "node:path";
import type { Analyzer, FileIR, TextSpan, TokenInfo } from "../types";

/**
 * # FileEndAnalyzer
 *
 * Mark end of file position
 */
export class FileEndAnalyzer implements Analyzer {
	analyze(fileIR: FileIR, projectRoot: string): TokenInfo[] {
		const sourceCodePath = path.join(projectRoot, fileIR.relativePath);

		try {
			const sourceCode = fs.readFileSync(sourceCodePath, "utf8");
			const lines = sourceCode.split("\n");
			const lastLineIndex = Math.max(0, lines.length - 1);
			const lastLineLength = lines[lines.length - 1]?.length || 0;

			const span: TextSpan = {
				start: {
					line: lastLineIndex,
					column: lastLineLength,
				},
				end: {
					line: lastLineIndex,
					column: lastLineLength + 1,
				},
			};

			console.log(`GETTING FILE END: ${lastLineIndex} ${lastLineLength}`);

			return [
				{
					meta: [{ type: "endOfFile" }],
					span,
				},
			];
		} catch (error) {
			throw new Error(
				`Failed to analyze file ${sourceCodePath}: ${error}`,
			);
		}
	}
}
