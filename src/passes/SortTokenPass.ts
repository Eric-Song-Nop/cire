/**
 * Sort Token Pass
 *
 * Sorts tokens by their start position to ensure consistent processing order
 */

import type { TokenInfo } from "../types";
import { comparePositions } from "../utils/position-utils";
import type { TokenInfoPass } from "./TokenInfoPass";

export class SortTokenPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		return tokens.sort((a, b) => {
			return comparePositions(a.span.start, b.span.start);
		});
	}
}
