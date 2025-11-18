import type { TokenInfo } from "../types";
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

		// Assume tokens are already sorted by position
		for (const token of tokens) {
			const tokenStart = token.span.start;

			// If there's a gap between lastEnd and tokenStart, fill it with plaintext
			if (this.comparePositions(tokenStart, lastEnd) > 0) {
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
		}

		// Add a plaintext token from last token's end to the end of file
		// Use (-1, -1) to indicate "go to end of file"
		result.push({
			meta: [{ type: "plaintext" }],
			span: {
				start: lastEnd,
				end: { line: -1, column: -1 }, // Special marker for end of file
			},
		});

		return result;
	}

	/**
	 * Compare two positions. Return -1 if a < b, 0 if equal, 1 if a > b
	 */
	private comparePositions(
		posA: { line: number; column: number },
		posB: { line: number; column: number },
	): number {
		if (posA.line !== posB.line) {
			return posA.line - posB.line;
		}
		return posA.column - posB.column;
	}
}