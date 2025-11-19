/**
 * Position utility functions for comparing and manipulating line/column positions
 */

/**
 * Compare two positions. Return -1 if a < b, 0 if equal, 1 if a > b
 */
export function comparePositions(
	posA: { line: number; column: number },
	posB: { line: number; column: number },
): number {
	if (posA.line !== posB.line) {
		return posA.line - posB.line;
	}
	return posA.column - posB.column;
}

/**
 * Check if two positions are the same
 */
export function isSamePosition(
	posA: { line: number; column: number },
	posB: { line: number; column: number },
): boolean {
	return posA.line === posB.line && posA.column === posB.column;
}
