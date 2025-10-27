/**
 * Merge Token Pass
 *
 * Detects and merges overlapping token spans to prevent HTML rendering conflicts
 * Example:
 *   Input:  [{classes: ["a"], span: [1-5]}, {classes: ["b"], span: [3-7]}]
 *   Output: [{classes: ["a"], span: [1-2]}, {classes: ["a", "b"], span: [3-5]}, {classes: ["b"], span: [6-7]}]
 */

import type { TokenInfo } from "../types";
import { mergeHighlightClasses, type TokenInfoPass } from "./TokenInfoPass";

interface TokenRange {
	start: { line: number; column: number };
	end: { line: number; column: number };
	classes: string[];
}

export class MergeTokenPass implements TokenInfoPass {
	process(tokens: TokenInfo[]): TokenInfo[] {
		if (tokens.length === 0) {
			return [];
		}

		return this.mergeOverlappingTokens(tokens);
	}

	private mergeOverlappingTokens(tokens: TokenInfo[]): TokenInfo[] {
		// Sort tokens by start position
		const sortedTokens = [...tokens].sort((a, b) => {
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}
			return a.span.start.column - b.span.start.column;
		});

		// Convert to a more manageable format and identify all unique positions
		const ranges: TokenRange[] = sortedTokens.map((token) => ({
			start: token.span.start,
			end: token.span.end,
			classes: this.extractClasses(token),
		}));

		// Generate all boundary points
		const boundaries = this.generateBoundaries(ranges);

		// Create segments between boundaries
		const segments = this.createSegments(boundaries, ranges);

		// Convert segments back to TokenInfo format
		return segments.map((segment) => ({
			span: {
				start: segment.start,
				end: segment.end,
			},
			meta: [
				{
					type: "highlight",
					highlightClasses: segment.classes,
				},
			],
		}));
	}

	/**
	 * Extract highlight classes from a token
	 */
	private extractClasses(token: TokenInfo): string[] {
		for (const meta of token.meta) {
			if (meta.type === "highlight") {
				return meta.highlightClasses;
			}
		}
		return [];
	}

	/**
	 * Generate all unique boundary points from token ranges
	 */
	private generateBoundaries(
		ranges: TokenRange[],
	): { line: number; column: number }[] {
		const boundaries = new Set<string>();

		for (const range of ranges) {
			boundaries.add(this.positionToString(range.start));
			boundaries.add(this.positionToString(range.end));
		}

		// Convert back to position objects and sort
		const boundaryArray = Array.from(boundaries).map((posStr) =>
			this.stringToPosition(posStr),
		);

		return boundaryArray.sort((a, b) => {
			if (a.line !== b.line) {
				return a.line - b.line;
			}
			return a.column - b.column;
		});
	}

	/**
	 * Create segments between boundaries and assign classes
	 */
	private createSegments(
		boundaries: { line: number; column: number }[],
		ranges: TokenRange[],
	): TokenRange[] {
		const segments: TokenRange[] = [];

		for (let i = 0; i < boundaries.length - 1; i++) {
			const segmentStart = boundaries[i];
			const segmentEnd = boundaries[i + 1];

			// Find all ranges that cover this segment
			const coveringRanges = ranges.filter(
				(range) =>
					this.isPositionBeforeOrEqual(range.start, segmentStart) &&
					this.isPositionAfterOrEqual(range.end, segmentEnd),
			);

			// Merge all classes from covering ranges
			const allClasses = coveringRanges.map((r) => r.classes);
			const mergedClasses = mergeHighlightClasses(allClasses);

			segments.push({
				start: segmentStart,
				end: segmentEnd,
				classes: mergedClasses,
			});
		}

		return segments;
	}

	/**
	 * Convert position to string for Set operations
	 */
	private positionToString(pos: { line: number; column: number }): string {
		return `${pos.line}:${pos.column}`;
	}

	/**
	 * Convert string back to position object
	 */
	private stringToPosition(str: string): { line: number; column: number } {
		const [line, column] = str.split(":").map(Number);
		return { line, column };
	}

	/**
	 * Check if positionA is before or equal to positionB
	 */
	private isPositionBeforeOrEqual(
		posA: { line: number; column: number },
		posB: { line: number; column: number },
	): boolean {
		if (posA.line !== posB.line) {
			return posA.line < posB.line;
		}
		return posA.column <= posB.column;
	}

	/**
	 * Check if positionA is after or equal to positionB
	 */
	private isPositionAfterOrEqual(
		posA: { line: number; column: number },
		posB: { line: number; column: number },
	): boolean {
		if (posA.line !== posB.line) {
			return posA.line > posB.line;
		}
		return posA.column >= posB.column;
	}
}
