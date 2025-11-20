import type { Position, TokenInfo } from "../types";
import { comparePositions } from "../utils/position-utils";
import type { TokenInfoPass } from "./TokenInfoPass";

/**
 * FillPlaintextPass - Fills gaps between tokens with plaintext tokens
 * This ensures every character in the source file is covered by a token
 */
export class FillPlaintextPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		const result: TokenInfo[] = [];
		let lastEnd = { line: 0, column: 0 };

		let eofPos: Position | null = null;
		// Assume tokens are already sorted by position
		for (const token of tokens) {
			const tokenStart = token.span.start;

			// If there's a gap between lastEnd and tokenStart, fill it with plaintext
			if (comparePositions(tokenStart, lastEnd) > 0) {
				result.push({
					meta: [{ type: "plaintext" }],
					span: {
						start: lastEnd,
						end: tokenStart,
					},
				});
			}

			result.push(token);
			lastEnd = token.span.end;
			if (
				token.meta.some((m) => {
					return m.type === "endOfFile";
				})
			) {
				eofPos = token.span.end;
			}
		}

		if (!eofPos) {
			// Add a plaintext token from last token's end to the end of file
			// Use (-1, -1) to indicate "go to end of file"
			result.push({
				meta: [{ type: "plaintext" }],
				span: {
					start: lastEnd,
					end: { line: -1, column: -1 }, // Special marker for end of file
				},
			});
		}

		return result;
	}
}
