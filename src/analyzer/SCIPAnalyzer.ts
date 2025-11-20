/**
 * # Scip Analyzer Class
 *
 * SCIPAnalyzer uses a SCIP index file to provide lsp documentation.
 * [SCIP](https://github.com/sourcegraph/scip) is the source indexing format provided by Sourcegraph.
 * Which is a lsif compatible implementation with accelerated with google-protobuf.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { scip } from "@sourcegraph/scip/bindings/typescript/scip.js";
import { BinaryReader } from "google-protobuf";
import type {
	Analyzer,
	FileIR,
	MetaInfo,
	Position,
	TextSpan,
	TokenInfo,
} from "../types";

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
		// First we get all document symbols and external symbols
		const accessible_symbols: scip.SymbolInformation[] =
			document.symbols.concat(this.scipIndex.external_symbols);

		const symbolMap: Record<string, scip.SymbolInformation> = {};
		for (const symbol of accessible_symbols) {
			symbolMap[symbol.symbol] = symbol;
		}

		const symbolDefSpan: Record<string, Position> = {};
		for (const occurrence of document.occurrences) {
			if (!(occurrence.symbol in symbolMap)) {
				continue;
			}
			if ((occurrence.symbol_roles & scip.SymbolRole.Definition) === 0)
				continue;
			const span: TextSpan | null = this.convertSCIPRangeToTextSpan(
				occurrence.range,
			);
			if (!span) continue;
			const pos: Position = span.start;

			symbolDefSpan[occurrence.symbol] = pos;
		}

		const infos: TokenInfo[] = [];
		for (const occurrence of document.occurrences) {
			if (!(occurrence.symbol in symbolMap)) {
				continue;
			}
			const sym = symbolMap[occurrence.symbol];
			const span: TextSpan | null = this.convertSCIPRangeToTextSpan(
				occurrence.range,
			);
			if (!span) continue;
			const meta: MetaInfo[] = [];

			// Generate symbol ID for this occurrence
			const symbolId = this.generateSymbolId(occurrence.symbol);
			const symbolName = sym.display_name || sym.symbol;

			// Check if this is a definition or reference
			const isDefinition =
				(occurrence.symbol_roles & scip.SymbolRole.Definition) !== 0;

			if (isDefinition) {
				// This is a definition token
				meta.push({
					type: "symbolDefinition",
					symbolId,
					symbolName,
				});
			} else {
				// This is a reference token
				meta.push({
					type: "symbolReference",
					symbolId,
					symbolName,
				});
			}

			// Resolve complete documentation with priority hierarchy
			const documentation = this.resolveDocumentation(occurrence, sym);
			if (documentation) {
				meta.push({
					type: "hover",
					content: occurrence.symbol,
					documentation,
				});
			}

			infos.push({
				meta,
				span,
			});
		}

		return infos;
	}

	/**
	 * Generate HTML-compatible symbol ID from SCIP symbol
	 */
	private generateSymbolId(symbol: string): string {
		// Replace non-alphanumeric characters with underscores
		return `symbol-${symbol.replace(/[^a-zA-Z0-9]/g, "_")}`;
	}

	/**
	 * Resolve documentation with priority:
	 * 1. override_documentation
	 * 2. signature_documentation
	 * 3. documentation
	 *
	 * All available documentation is preserved and separated by newlines.
	 */
	private resolveDocumentation(
		occurrence: scip.Occurrence,
		symbolInfo: scip.SymbolInformation,
	): string {
		const docParts: string[] = [];

		if (
			occurrence.override_documentation &&
			occurrence.override_documentation.length > 0
		) {
			docParts.push(...occurrence.override_documentation);
		}

		if (
			symbolInfo.has_signature_documentation &&
			symbolInfo.signature_documentation?.text
		) {
			const signature = symbolInfo.signature_documentation.text.trim();
			const language =
				symbolInfo.signature_documentation.language || "text";
			docParts.push(`\`\`\`${language}\n${signature}\n\`\`\``);
		}

		if (symbolInfo.documentation && symbolInfo.documentation.length > 0) {
			docParts.push(...symbolInfo.documentation);
		}

		return docParts.join("\n\n"); // Separate different documentation types with double newlines
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
