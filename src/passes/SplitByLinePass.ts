/**
 * # Split all tokens at line break and mark line boundaries
 *
 * This pass ensures that all tokens do not spread multiple lines.
 * Additionally, it marks tokens that are at the start or end of lines.
 * This pass is only required for Markdown output.
 */

import type { TextSpan, TokenInfo } from "../types";
import type { TokenInfoPass } from "./TokenInfoPass";

export class SplitByLinePass implements TokenInfoPass {
	/**
	 * Process tokens and split any that span multiple lines,
	 * while simultaneously marking tokens that are at the start or end of their lines
	 *
	 * @param tokens - Array of TokenInfo objects to process
	 * @returns New array with all tokens limited to single lines and marked with line positions
	 */
	process(tokens: TokenInfo[]): TokenInfo[] {
		const result: TokenInfo[] = [];

		// Group all resulting tokens by line as we process them
		const tokensByLine = new Map<number, TokenInfo[]>();

		for (const token of tokens) {
			if (token.span.start.line === token.span.end.line) {
				// Single line token - add to its line directly
				const lineNumber = token.span.start.line;
				if (!tokensByLine.has(lineNumber)) {
					tokensByLine.set(lineNumber, []);
				}
				tokensByLine.get(lineNumber)?.push(token);
			} else {
				// Multi-line token - split it and add each part to its respective line
				const splitTokens = this.splitTokenByLines(token);
				for (const splitToken of splitTokens) {
					const lineNumber = splitToken.span.start.line;
					if (!tokensByLine.has(lineNumber)) {
						tokensByLine.set(lineNumber, []);
					}
					tokensByLine.get(lineNumber)?.push(splitToken);
				}
			}
		}

		// Now process each line's tokens and add line position markers
		for (const [, lineTokens] of tokensByLine) {
			// Sort tokens by start column to determine position
			const sortedTokens = [...lineTokens].sort(
				(a, b) => a.span.start.column - b.span.start.column,
			);

			const firstToken = sortedTokens[0];
			const lastToken = sortedTokens[sortedTokens.length - 1];
			if (lastToken.meta.some((m) => m.type === "endOfFile")) {
				result.push(...sortedTokens);
				continue;
			}
			if (!firstToken.meta.some((m) => m.type === "comment")) {
				firstToken.meta.push({ type: "startOfLine" });
				if (lastToken.meta.some((m) => m.type === "comment")) {
					firstToken.meta.push({ type: "endOfLine" });
				} else {
					lastToken.meta.push({ type: "endOfLine" });
				}
			}

			// Add all processed tokens to the result array
			result.push(...sortedTokens);
		}

		return result;
	}

	/**
	 * Split a multi-line token into multiple single-line tokens
	 *
	 * @param token - The multi-line token to split
	 * @returns Array of single-line tokens
	 */
	private splitTokenByLines(token: TokenInfo): TokenInfo[] {
		if (token.meta.some((m) => m.type === "comment")) {
			return [token];
		}
		const result: TokenInfo[] = [];
		const { span, meta } = token;

		let currentLine = span.start.line;
		let currentColumn = span.start.column;

		// Iterate through each line the token spans
		while (currentLine <= span.end.line) {
			const isFirstLine = currentLine === span.start.line;
			const isLastLine = currentLine === span.end.line;

			// Calculate the span for the current line portion
			const tokenSpan: TextSpan = {
				start: {
					line: currentLine,
					column: isFirstLine ? currentColumn : 0,
				},
				end: {
					line: currentLine,
					column: isLastLine
						? span.end.column
						: Number.MAX_SAFE_INTEGER,
				},
			};

			// Create new token with the same metadata but adjusted span
			const splitToken: TokenInfo = {
				span: tokenSpan,
				meta: [...meta], // Copy metadata array
			};

			result.push(splitToken);

			// Move to next line
			currentLine++;
			currentColumn = 0;
		}

		return result;
	}
}
