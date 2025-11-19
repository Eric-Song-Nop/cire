/**
 * Merge Token Pass
 *
 * Splits overlapping token spans into minimal non-overlapping segments.
 * This is a pure splitting algorithm that preserves all meta information.
 * Note: Tokens should already be sorted by SortTokenPass before this pass.
 *
 * Example:
 *   Input: [{span: [1-5], meta: [highlight]}, {span: [3-7], meta: [hover]}]
 *   Output: [
 *     {span: [1-2], meta: [highlight]},
 *     {span: [3-5], meta: [highlight, hover]},
 *     {span: [6-7], meta: [hover]}
 *   ]
 *
 * Note: This pass does NOT handle comment priority. Use CommentMergePass for that.
 */

import type { MetaInfo, TokenInfo } from "../types";
import { comparePositions, isSamePosition } from "../utils/position-utils";
import type { TokenInfoPass } from "./TokenInfoPass";

export class MergeTokenPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		return this.splitOverlappingTokens(tokens);
	}

	/**
	 * Split overlapping tokens into minimal non-overlapping segments
	 * using a single-pass event-driven algorithm
	 */
	private splitOverlappingTokens(tokens: TokenInfo[]): TokenInfo[] {
		const result: TokenInfo[] = [];
		let activeTokens: TokenInfo[] = [];
		let currentPosition = tokens[0].span.start;
		let tokenIndex = 0;

		// Process all events (starts and ends) in order
		while (tokenIndex < tokens.length || activeTokens.length > 0) {
			const nextEvent = this.findNextEvent(
				tokens,
				tokenIndex,
				activeTokens,
			);

			// Create segment for the range [currentPosition, nextEvent.position)
			if (comparePositions(currentPosition, nextEvent.position) < 0) {
				const segment = this.createSegment(
					currentPosition,
					nextEvent.position,
					activeTokens,
				);
				if (segment) {
					result.push(segment);
				}
			}

			// Process events at this position
			const eventResult = this.processEventsAtPosition(
				nextEvent.position,
				tokens,
				tokenIndex,
				activeTokens,
			);
			activeTokens = eventResult.updatedActiveTokens;

			currentPosition = nextEvent.position;
			tokenIndex = eventResult.newStartIndex;
		}

		return result;
	}

	/**
	 * Find the next event (start or end) from the remaining tokens and active tokens
	 */
	private findNextEvent(
		tokens: TokenInfo[],
		startIndex: number,
		activeTokens: TokenInfo[],
	): { position: { line: number; column: number }; nextIndex: number } {
		let nextPosition: { line: number; column: number };
		let isEndEvent = false;

		// Find the next start event
		if (startIndex < tokens.length) {
			nextPosition = tokens[startIndex].span.start;
		} else if (activeTokens.length > 0) {
			// No more start events, find next end from active tokens
			nextPosition = this.findNextEnd(activeTokens);
			isEndEvent = true;
		} else {
			// Should never reach here with proper loop condition
			throw new Error("No more tokens or active tokens to process");
		}

		// Find the next end event from active tokens and compare with start
		if (activeTokens.length > 0 && !isEndEvent) {
			const nextEnd = this.findNextEnd(activeTokens);
			// Return whichever comes first: next start or next end
			if (comparePositions(nextEnd, nextPosition) < 0) {
				return { position: nextEnd, nextIndex: startIndex };
			}
		}

		return { position: nextPosition, nextIndex: startIndex };
	}

	/**
	 * Find the earliest end position from active tokens
	 */
	private findNextEnd(activeTokens: TokenInfo[]): {
		line: number;
		column: number;
	} {
		return activeTokens.reduce((earliest, token) => {
			if (comparePositions(token.span.end, earliest) < 0) {
				return token.span.end;
			}
			return earliest;
		}, activeTokens[0].span.end);
	}

	/**
	 * Process all events (starts and ends) that occur at the given position
	 */
	private processEventsAtPosition(
		position: { line: number; column: number },
		tokens: TokenInfo[],
		startIndex: number,
		activeTokens: TokenInfo[],
	): { newStartIndex: number; updatedActiveTokens: TokenInfo[] } {
		let newStartIndex = startIndex;
		const updatedActiveTokens = [...activeTokens];

		// Add new tokens that start at this position
		while (
			newStartIndex < tokens.length &&
			isSamePosition(tokens[newStartIndex].span.start, position)
		) {
			updatedActiveTokens.push(tokens[newStartIndex]);
			newStartIndex++;
		}

		// Remove tokens that end at this position
		const filteredTokens = updatedActiveTokens.filter(
			(token) => !isSamePosition(token.span.end, position),
		);

		return { newStartIndex, updatedActiveTokens: filteredTokens };
	}

	/**
	 * Create a segment for the given range with all active tokens' meta
	 */
	private createSegment(
		start: { line: number; column: number },
		end: { line: number; column: number },
		activeTokens: TokenInfo[],
	): TokenInfo | null {
		if (activeTokens.length === 0) {
			return null;
		}

		// Collect all meta from active tokens
		const allMeta: MetaInfo[] = [];
		for (const token of activeTokens) {
			allMeta.push(...token.meta);
		}

		return {
			span: { start, end },
			meta: allMeta,
		};
	}
}
