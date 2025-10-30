import fs from "node:fs";
import * as path from "node:path";
import type { Analyzer, FileIR, TokenInfo } from "../types";

import Parser = require("tree-sitter");

import TypeScriptLangs from "tree-sitter-typescript";

export class TSHighLighter implements Analyzer {
	private parser = new Parser();

	lang: string;
	parserLang: Parser.Language;
	theme: Record<string, string[]> = {};

	constructor(lang?: string, parserLang?: Parser.Language) {
		this.lang = lang || "typescript";
		this.parserLang =
			parserLang || (TypeScriptLangs.typescript as Parser.Language);
		// Initialize theme with basic syntax highlighting classes
		this.theme = {
			type: ["type"],
			"type.builtin": ["type", "builtin"],
			variable: ["variable"],
			"variable.parameter": ["variable", "parameter"],
			"variable.builtin": ["variable", "builtin"],
			property: ["property"],
			function: ["function"],
			"function.method": ["function", "method"],
			"function.builtin": ["function", "builtin"],
			constructor: ["constructor"],
			constant: ["constant"],
			"constant.builtin": ["constant", "builtin"],
			keyword: ["keyword"],
			comment: ["comment"],
			string: ["string"],
			"string.special": ["string", "special"],
			number: ["number"],
			"punctuation.delimiter": ["punctuation", "delimiter"],
			"punctuation.bracket": ["punctuation", "bracket"],
			"punctuation.special": ["punctuation", "special"],
			operator: ["operator"],
			embedded: ["embedded"],
		};
	}

	analyze(fileIR: FileIR, projectRoot: string): TokenInfo[] {
		this.parser.setLanguage(this.parserLang);
		const sourceCodePath = path.join(projectRoot, fileIR.relativePath);
		const sourceCode = fs.readFileSync(sourceCodePath).toString();
		const tree = this.parser.parse(sourceCode);

		// Read query statements from template file
		const queryPath = path.resolve(
			__dirname,
			"../../templates/queries",
			this.lang,
			"highlight.scm",
		);
		const queryContent = fs.readFileSync(queryPath).toString();
		const querier = new Parser.Query(this.parserLang, queryContent);

		// Execute query and capture results
		const captures = querier.captures(tree.rootNode);
		const tokenInfos: TokenInfo[] = captures.map((capture) => ({
			meta: [
				{
					type: "highlight",
					highlightClasses: this.theme[capture.name] || [
						capture.name.replace(".", "-"),
					],
				},
			],
			span: {
				start: {
					line: capture.node.startPosition.row,
					column: capture.node.startPosition.column,
				},
				end: {
					line: capture.node.endPosition.row,
					column: capture.node.endPosition.column,
				},
			},
		}));

		return tokenInfos;
	}
}
