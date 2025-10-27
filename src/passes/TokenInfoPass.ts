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

/**
 * Utility function to convert position to character offset
 */
export function positionToOffset(
	text: string,
	pos: { line: number; column: number },
): number {
	const lines = text.split("\n");
	let offset = 0;

	for (let i = 0; i < pos.line; i++) {
		offset += lines[i].length + 1; // +1 for newline
	}

	return offset + pos.column;
}

/**
 * Utility function to convert character offset to position
 */
export function offsetToPosition(
	text: string,
	offset: number,
): { line: number; column: number } {
	const lines = text.split("\n");
	let currentOffset = 0;
	let line = 0;
	let column = 0;

	for (let i = 0; i < lines.length; i++) {
		if (currentOffset + lines[i].length >= offset) {
			line = i;
			column = offset - currentOffset;
			break;
		}
		currentOffset += lines[i].length + 1; // +1 for newline
	}

	return { line, column };
}

/**
 * Utility function to merge highlight classes, removing duplicates
 */
export function mergeHighlightClasses(classesArray: string[][]): string[] {
	const allClasses = new Set<string>();

	for (const classes of classesArray) {
		for (const cls of classes) {
			allClasses.add(cls);
		}
	}

	return Array.from(allClasses).sort(); // Sort for consistency
}
