import type { MetaInfo, Position, TokenInfo } from "../types";
import type { TokenInfoPass } from "./TokenInfoPass";

/**
 * CommentMergePass prioritizes and merges comment tokens.
 *
 * This pass performs two main operations:
 * 1. Prioritizes comment meta over other meta types (keeps only comment when present)
 * 2. Merges adjacent comment tokens into single comment tokens
 *
 * Note: Tokens should already be sorted by SortTokenPass and processed by MergeTokenPass
 * before this pass to ensure proper ordering and no overlapping spans.
 */
export class CommentMergePass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		// Step 1: Prioritize comment meta over other meta types
		const prioritizedTokens = this.prioritizeCommentMeta(tokens);

		// Step 2: Merge adjacent comment tokens
		const mergedTokens = this.mergeAdjacentComments(prioritizedTokens);

		return mergedTokens;
	}

	/**
	 * Prioritize comment meta over other meta types.
	 * For tokens that have comment meta, keep only one comment meta and remove all others.
	 */
	private prioritizeCommentMeta(tokens: TokenInfo[]): TokenInfo[] {
		return tokens.map((token) => {
			const hasComment = this.hasCommentMeta(token);

			if (hasComment) {
				// Keep only one comment meta, remove all other meta
				return {
					...token,
					meta: [{ type: "comment" }] as MetaInfo[],
				};
			}

			// No comment meta, keep token as is
			return token;
		});
	}

	/**
	 * Merge adjacent comment tokens into single comment tokens.
	 * Uses a single-pass algorithm for efficiency.
	 */
	private mergeAdjacentComments(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		const result: TokenInfo[] = [];
		let currentMergeGroup: TokenInfo[] = [];

		for (const token of tokens) {
			if (this.isPureCommentToken(token)) {
				if (currentMergeGroup.length === 0) {
					// Start new merge group
					currentMergeGroup.push(token);
				} else if (
					this.areAdjacent(
						currentMergeGroup[currentMergeGroup.length - 1],
						token,
					)
				) {
					// Adjacent to current group, extend the group
					currentMergeGroup.push(token);
				} else {
					// Not adjacent, flush current group and start new one
					if (currentMergeGroup.length > 0) {
						result.push(
							this.createMergedCommentToken(currentMergeGroup),
						);
					}
					currentMergeGroup = [token];
				}
			} else {
				// Not a comment token, flush any pending merge group
				if (currentMergeGroup.length > 0) {
					result.push(
						this.createMergedCommentToken(currentMergeGroup),
					);
					currentMergeGroup = [];
				}
				// Add non-comment token as is
				result.push(token);
			}
		}

		// Flush any remaining merge group
		if (currentMergeGroup.length > 0) {
			result.push(this.createMergedCommentToken(currentMergeGroup));
		}

		return result;
	}

	/**
	 * Create a single merged comment token from a group of adjacent comment tokens
	 */
	private createMergedCommentToken(tokens: TokenInfo[]): TokenInfo {
		if (tokens.length === 0) {
			throw new Error("Cannot create merged token from empty group");
		}

		if (tokens.length === 1) {
			return tokens[0];
		}

		// Merge ranges: start from first token, end at last token
		const mergedSpan = {
			start: tokens[0].span.start,
			end: tokens[tokens.length - 1].span.end,
		};

		return {
			span: mergedSpan,
			meta: [{ type: "comment" }] as MetaInfo[],
		};
	}

	/**
	 * Check if a token has comment meta
	 */
	private hasCommentMeta(token: TokenInfo): boolean {
		return token.meta.some((meta) => meta.type === "comment");
	}

	/**
	 * Check if a token is purely a comment token (only contains comment meta)
	 */
	private isPureCommentToken(token: TokenInfo): boolean {
		return token.meta.length === 1 && token.meta[0].type === "comment";
	}

	/**
	 * Check if two tokens are adjacent (no gap between them)
	 */
	private areAdjacent(token1: TokenInfo, token2: TokenInfo): boolean {
		return this.isSamePosition(token1.span.end, token2.span.start);
	}

	/**
	 * Check if two positions are the same
	 */
	private isSamePosition(pos1: Position, pos2: Position): boolean {
		return pos1.line === pos2.line && pos1.column === pos2.column;
	}
}
