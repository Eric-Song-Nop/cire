/**
 * Merge Token Pass
 *
 * Detects and merges overlapping token spans to prevent HTML rendering conflicts
 * Note: Tokens should already be sorted by SortTokenPass before this pass
 *
 * Example:
 *   Input: [{classes: ["a"], span: [1-5]}, {classes: ["b"], span: [3-7]}]
 *   Output: [{classes: ["a"], span: [1-2]}, {classes: ["a", "b"], span: [3-5]}, {classes: ["b"], span: [6-7]}]
 *
 * Note: when area is marked as comment, we remove all infos collapsed with it.
 */

import type { MetaInfo, TokenInfo } from "../types";
import type { TokenInfoPass } from "./TokenInfoPass";

export class MergeTokenPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		return this.mergeOverlappingTokens(tokens);
	}

	private mergeOverlappingTokens(tokens: TokenInfo[]): TokenInfo[] {
		// Note: Tokens should already be sorted by SortTokenPass
		if (tokens.length === 0) {
			return [];
		}

		const mergedTokens: TokenInfo[] = [];
		let currentTokens: TokenInfo[] = [tokens[0]];

		for (let i = 1; i < tokens.length; i++) {
			const nextToken = tokens[i];

			// Find the earliest end position among current tokens
			const currentEnd = this.getEarliestEnd(currentTokens);

			// If next token starts after current tokens end, finalize current tokens
			if (this.isPositionAfter(nextToken.span.start, currentEnd)) {
				// Create merged segments for current tokens
				mergedTokens.push(...this.createMergedTokens(currentTokens));
				// Start new group with next token
				currentTokens = [nextToken];
			} else {
				// Add to current group (overlapping)
				currentTokens.push(nextToken);
			}
		}

		// Don't forget the last group
		if (currentTokens.length > 0) {
			mergedTokens.push(...this.createMergedTokens(currentTokens));
		}

		return mergedTokens;
	}

	/**
	 * Get the earliest end position from a group of tokens
	 */
	private getEarliestEnd(tokens: TokenInfo[]): {
		line: number;
		column: number;
	} {
		return tokens.reduce((earliest, token) => {
			if (this.isPositionBefore(token.span.end, earliest)) {
				return token.span.end;
			}
			return earliest;
		}, tokens[0].span.end);
	}

	/**
	 * Create merged segments from a group of overlapping tokens
	 */
	private createMergedTokens(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 1) {
			return tokens;
		}

		// Collect all meta info from overlapping tokens
		const allMeta: MetaInfo[] = [];

		for (const token of tokens) {
			allMeta.push(...token.meta);
		}

		// Calculate the merged span (union of all overlapping spans)
		const start = tokens[0].span.start;
		const end = this.getLatestEnd(tokens);

		return [
			{
				span: { start, end },
				meta: allMeta,
			},
		];
	}

	/**
	 * Get the latest end position from a group of tokens
	 */
	private getLatestEnd(tokens: TokenInfo[]): {
		line: number;
		column: number;
	} {
		return tokens.reduce((latest, token) => {
			if (this.isPositionAfter(token.span.end, latest)) {
				return token.span.end;
			}
			return latest;
		}, tokens[0].span.end);
	}

	/**
	 * Check if positionA is before positionB
	 */
	private isPositionBefore(
		posA: { line: number; column: number },
		posB: { line: number; column: number },
	): boolean {
		if (posA.line !== posB.line) {
			return posA.line < posB.line;
		}
		return posA.column < posB.column;
	}

	/**
	 * Check if positionA is after positionB
	 */
	private isPositionAfter(
		posA: { line: number; column: number },
		posB: { line: number; column: number },
	): boolean {
		if (posA.line !== posB.line) {
			return posA.line > posB.line;
		}
		return posA.column > posB.column;
	}
}
