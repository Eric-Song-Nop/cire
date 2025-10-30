/**
 * # Scip Analyzer Class
 *
 * SCIPAnalyzer uses a SCIP index file to provide lsp documentation
 * [SCIP](https://github.com/sourcegraph/scip) is the source indexing format provided by Sourcegraph.
 * Which is a lsif compatible implementation with accelerated with google-protobuf.
 */
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

		// Handle project_root that might be in URI format (file:/path)
		let projectRoot = this.scipIndex.metadata.project_root;
		if (projectRoot.startsWith("file:")) {
			// Remove file:// or file: prefix and decode URI
			projectRoot = decodeURIComponent(
				projectRoot.replace(/^file:\/+/, "/"),
			);
		}

		this.scipProjectRoot = path.resolve(projectRoot);
	}

	analyze(fileIR: FileIR, projectRoot: string): TokenInfo[] {
		if (!this.scipIndex) {
			console.warn(`SCIP index not loaded: ${this.scipIndexPath}`);
			return [];
		}

		// Find document in SCIP index - try different possible APIs
		const documentsList = this.scipIndex.documents;

		const document = documentsList.find((doc) => {
			const docAbsolutePath = path.resolve(
				this.scipProjectRoot,
				doc.relative_path,
			);
			const ourAbsolutePath = path.resolve(
				projectRoot,
				fileIR.relativePath,
			);
			return ourAbsolutePath === docAbsolutePath;
		});

		if (!document) {
			console.warn(
				`File not found in SCIP index: ${fileIR.relativePath}`,
			);
			return [];
		}
		return this.resolveHoverInfo(document);
	}

	private resolveHoverInfo(document: scip.Document): TokenInfo[] {
		const occurrences = document.occurrences;
		const tokenInfos: TokenInfo[] = [];

		console.log(`🔍 Analyzing document: ${document.relative_path}`);
		console.log(
			`  📄 Found ${occurrences ? occurrences.length : 0} occurrences`,
		);

		if (!occurrences || occurrences.length === 0) {
			return [];
		}

		for (const occurrence of occurrences) {
			// Skip occurrences without range or symbol
			if (!occurrence.range || !occurrence.symbol) continue;

			// Convert SCIP range to TextSpan
			const span = this.convertSCIPRangeToTextSpan(occurrence.range);
			if (!span) continue;

			// Try to find symbol documentation from symbols in the document first
			let symbolInfo = document.symbols?.find(
				(sym) => sym.symbol === occurrence.symbol,
			);

			// If not found in current document, search globally across all documents
			if (!symbolInfo) {
				symbolInfo = this.findSymbolGlobally(occurrence.symbol);
			}

			const doc: string[] = [];
			// Add documentation if available
			if (symbolInfo?.documentation) {
				doc.push(...symbolInfo.documentation);
			}
			if (occurrence.override_documentation) {
				doc.push(...occurrence.override_documentation);
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

		console.log(`  🎯 Generated ${tokenInfos.length} hover tokens`);
		return tokenInfos;
	}

	/**
	 * Find symbol information across all documents in the SCIP index
	 */
	private findSymbolGlobally(
		symbolName: string,
	): scip.SymbolInformation | undefined {
		if (!this.scipIndex?.documents) {
			return undefined;
		}

		// Search through all documents for the symbol
		for (const doc of this.scipIndex.documents) {
			if (!doc.symbols) continue;

			const symbolInfo = doc.symbols.find(
				(sym) => sym.symbol === symbolName,
			);
			if (symbolInfo) {
				console.log(
					`  🌍 Found symbol in external document: ${doc.relative_path}`,
				);
				return symbolInfo;
			}
		}

		return undefined;
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
