/**
 * Sort Token Pass
 *
 * Sorts tokens by their start position to ensure consistent processing order
 */

import type { TokenInfo } from "../types";
import type { TokenInfoPass } from "./TokenInfoPass";

export class SortTokenPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		return tokens.sort((a, b) => {
			// First compare start line
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}

			// If on same line, compare start column
			return a.span.start.column - b.span.start.column;
		});
	}
}
