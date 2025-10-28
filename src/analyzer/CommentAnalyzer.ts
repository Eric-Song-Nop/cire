import fs from "node:fs";
import type { Analyzer, FileIR, TokenInfo } from "../types";

import Parser = require("tree-sitter");

import TypeScriptLangs from "tree-sitter-typescript";

/**
 * CommentAnalyzer - extracts block comments
 * Handles block comments (slash asterisk) and JSDoc comments
 */
export class CommentAnalyzer implements Analyzer {
	private parser = new Parser();
	private parserLang: Parser.Language;

	constructor(parserLang?: Parser.Language) {
		this.parserLang =
			parserLang || (TypeScriptLangs.typescript as Parser.Language);
	}

	/**
	 * Analyze file and extract block comments as tokens
	 */
	analyze(fileIR: FileIR): TokenInfo[] {
		this.parser.setLanguage(this.parserLang);
		const sourceCodePath = fileIR.filePath;
		const sourceCode = fs.readFileSync(sourceCodePath).toString();
		const tree = this.parser.parse(sourceCode);

		// Create query for block comments using Parser.Query
		// This captures comment blocks
		const query = new Parser.Query(
			this.parserLang,
			`
        (comment) @comment.block
        `,
		);

		const captures = query.captures(tree.rootNode);
		const commentTokens: TokenInfo[] = [];

		for (const capture of captures) {
			const node = capture.node;
			const commentText = sourceCode.slice(
				node.startIndex,
				node.endIndex,
			);

			// Only process block comments
			if (commentText.trim().startsWith("/*")) {
				commentTokens.push({
					meta: [
						{
							type: "comment",
						},
					],
					span: {
						start: {
							line: node.startPosition.row,
							column: node.startPosition.column,
						},
						end: {
							line: node.endPosition.row,
							column: node.endPosition.column,
						},
					},
				});
			}
		}

		return commentTokens;
	}
}
