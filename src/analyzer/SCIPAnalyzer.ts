import { readFileSync } from "node:fs";
import path from "node:path";
import { scip } from "@sourcegraph/scip/bindings/typescript/scip.js";
import { BinaryReader } from "google-protobuf";
import type { Analyzer, FileIR, TokenInfo } from "../types";

export class SCIPAnalyzer implements Analyzer {
	private scipIndexPath: string;
	private scipIndex: scip.Index;
	private scipProjectRoot: string;

	constructor(scipIndexPath: string) {
		this.scipIndexPath = scipIndexPath;
		const reader = new BinaryReader(readFileSync(this.scipIndexPath));
		// load with protobuf
		this.scipIndex = scip.Index.deserialize(reader);
		this.scipProjectRoot = path.resolve(
			this.scipIndex.metadata.project_root,
		);
	}

	analyze(fileIR: FileIR): TokenInfo[] {
		if (!this.scipIndex) {
			console.warn(`SCIP index not loaded: ${this.scipIndexPath}`);
			return [];
		}

		// Find document in SCIP index - try different possible APIs
		const documentsList = this.scipIndex.documents;

		const document = documentsList.find((doc) => {
			return (
				fileIR.filePath ===
				path.resolve(this.scipProjectRoot, doc.relative_path)
			);
		});

		if (!document) {
			console.warn(`File not found in SCIP index: ${fileIR.filePath}`);
			return [];
		}

		return this.resolveHoverInfo(document);
	}

	private resolveHoverInfo(document: scip.Document): TokenInfo[] {
		const occurrences = document.occurrences;
		const tokenInfos: TokenInfo[] = [];

		for (const occurrence of occurrences) {
			// Skip occurrences without range or symbol
			if (!occurrence.range || !occurrence.symbol) continue;

			// Convert SCIP range to TextSpan
			const span = this.convertSCIPRangeToTextSpan(occurrence.range);
			if (!span) continue;

			// Try to find symbol documentation from symbols in the document
			const symbolInfo = document.symbols.find(
				(sym) => sym.symbol === occurrence.symbol,
			);

			const meta = [
				{
					type: "hover",
					content: occurrence.symbol,
				},
			];

			const doc: string[] = [];
			// Add documentation if available
			if (symbolInfo?.documentation) {
				doc.concat(symbolInfo.documentation);
			}
			if (occurrence.override_documentation) {
				doc.concat(occurrence.override_documentation);
			}

			if (doc.length === 0) continue;

			const tokenInfo: TokenInfo = {
				meta: [
					{
						type: "hover",
						content: occurrence.symbol,
						documentation: doc.join("\n"),
					},
				],
				span,
			};

			tokenInfos.push(tokenInfo);
		}

		return tokenInfos;
	}

	private convertSCIPRangeToTextSpan(range: number[]): {
		start: { line: number; column: number };
		end: { line: number; column: number };
	} | null {
		if (!range || (range.length !== 3 && range.length !== 4)) {
			return null;
		}

		if (range.length === 4) {
			// Format: [startLine, startCharacter, endLine, endCharacter]
			const [startLine, startCharacter, endLine, endCharacter] = range;
			return {
				start: {
					line: startLine,
					column: startCharacter,
				},
				end: {
					line: endLine,
					column: endCharacter,
				},
			};
		} else if (range.length === 3) {
			// Format: [startLine, startCharacter, endCharacter] (startLine == endLine)
			const [startLine, startCharacter, endCharacter] = range;
			return {
				start: {
					line: startLine,
					column: startCharacter,
				},
				end: {
					line: startLine,
					column: endCharacter,
				},
			};
		}

		return null;
	}
}
