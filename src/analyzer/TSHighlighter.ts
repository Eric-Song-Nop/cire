import fs from "node:fs";
import type { FileIR, HighLighter, TokenInfo } from "../types";

import Parser = require("tree-sitter");

import TypeScriptLangs from "tree-sitter-typescript";

export class TSHighLighter implements HighLighter {
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

	highlight(fileIR: FileIR): TokenInfo[] {
		this.parser.setLanguage(this.parserLang);
		const sourceCodePath = fileIR.filePath;
		const sourceCode = fs.readFileSync(sourceCodePath).toString();
		const tree = this.parser.parse(sourceCode);

		// 从模板文件读取查询语句
		const queryPath = `templates/highlight/${this.lang}.scm`;
		const queryContent = fs.readFileSync(queryPath).toString();
		const querier = new Parser.Query(this.parserLang, queryContent);

		// 执行查询并捕获结果
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
