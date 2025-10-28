/**
 * TokenInfo Pass Interface
 *
 * A pass processes an array of TokenInfo objects and returns a new array
 * This allows for modular processing of token information
 */

import type { TokenInfo } from "../types";

export interface TokenInfoPass {
	/**
	 * Process an array of tokens and return the processed array
	 */
	process(tokens: TokenInfo[]): TokenInfo[];
}
