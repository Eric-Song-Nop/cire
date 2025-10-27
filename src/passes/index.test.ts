/**
 * Unit tests for src/passes/index.ts
 *
 * Tests cover:
 * - MergeTokenPass class
 * - SortTokenPass class
 * - TokenInfoPass interface and utility functions
 */

import { beforeEach, describe, expect, it } from "vitest";
// Test imports from index.ts
import {
	MergeTokenPass,
	mergeHighlightClasses,
	offsetToPosition,
	positionToOffset,
	SortTokenPass,
	type TokenInfoPass,
} from "../passes/index";
import type { TokenInfo } from "../types";

describe("passes/index.ts", () => {
	// Helper function to create test tokens
	function createToken(
		startLine: number,
		startColumn: number,
		endLine: number,
		endColumn: number,
		highlightClasses: string[] = [],
	): TokenInfo {
		return {
			span: {
				start: { line: startLine, column: startColumn },
				end: { line: endLine, column: endColumn },
			},
			meta:
				highlightClasses.length > 0
					? [{ type: "highlight", highlightClasses }]
					: [],
		};
	}

	describe("MergeTokenPass", () => {
		let mergePass: MergeTokenPass;

		beforeEach(() => {
			mergePass = new MergeTokenPass();
		});

		it("should return empty array for empty input", () => {
			const result = mergePass.process([]);
			expect(result).toEqual([]);
		});

		it("should return single token unchanged", () => {
			const tokens = [createToken(0, 0, 0, 5, ["keyword"])];
			const result = mergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 5 });
			expect(result[0].meta[0]).toEqual({
				type: "highlight",
				highlightClasses: ["keyword"],
			});
		});

		it("should handle non-overlapping tokens", () => {
			const tokens = [
				createToken(0, 0, 0, 5, ["keyword"]),
				createToken(0, 6, 0, 10, ["string"]),
			];
			const result = mergePass.process(tokens);

			// Should maintain 2 separate tokens since they don't overlap
			expect(result.length).toBeGreaterThanOrEqual(2);
		});

		it("should merge overlapping tokens correctly", () => {
			const tokens = [
				createToken(0, 1, 0, 5, ["keyword"]),
				createToken(0, 3, 0, 7, ["function"]),
			];
			const result = mergePass.process(tokens);

			// Should create segments based on boundary points: 1, 5, 3, 7
			// Boundaries sorted: 1, 3, 5, 7
			// Segments: [1-3], [3-5], [5-7]
			expect(result).toHaveLength(3);

			// First segment: only keyword (1-3)
			expect(result[0].span.start).toEqual({ line: 0, column: 1 });
			expect(result[0].span.end.column).toBeGreaterThanOrEqual(3);
			expect(result[0].meta[0].highlightClasses).toEqual(["keyword"]);

			// Middle segment: both keyword and function (3-5)
			expect(result[1].span.start).toEqual({ line: 0, column: 3 });
			expect(result[1].span.end.column).toBeGreaterThanOrEqual(5);
			expect(result[1].meta[0].highlightClasses).toEqual([
				"function",
				"keyword",
			]);

			// Last segment: only function (5-7)
			expect(result[2].span.start).toEqual({ line: 0, column: 5 });
			expect(result[2].span.end.column).toBeGreaterThanOrEqual(7);
			expect(result[2].meta[0].highlightClasses).toEqual(["function"]);
		});

		it("should handle tokens without highlight classes", () => {
			const tokens = [
				createToken(0, 0, 0, 5),
				createToken(0, 3, 0, 7, ["keyword"]),
			];
			const result = mergePass.process(tokens);

			// Should still work but filter out tokens without highlight classes
			expect(
				result.every((token) =>
					token.meta.some((meta) => meta.type === "highlight"),
				),
			).toBe(true);
		});

		it("should handle multi-line token overlaps", () => {
			const tokens = [
				createToken(0, 0, 1, 5, ["keyword"]),
				createToken(0, 3, 0, 10, ["string"]),
			];
			const result = mergePass.process(tokens);

			// Should handle multi-line spans correctly
			expect(result.length).toBeGreaterThan(0);
			expect(
				result.every(
					(token) => token.span.start.line <= token.span.end.line,
				),
			).toBe(true);
		});
	});

	describe("SortTokenPass", () => {
		let sortPass: SortTokenPass;

		beforeEach(() => {
			sortPass = new SortTokenPass();
		});

		it("should return empty array for empty input", () => {
			const result = sortPass.process([]);
			expect(result).toEqual([]);
		});

		it("should sort tokens by start position (line then column)", () => {
			const tokens = [
				createToken(1, 5, 1, 10, ["keyword"]),
				createToken(0, 0, 0, 5, ["string"]),
				createToken(1, 0, 1, 3, ["function"]),
				createToken(0, 10, 0, 15, ["comment"]),
			];
			const result = sortPass.process(tokens);

			expect(result).toHaveLength(4);

			// First: line 0, column 0
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });

			// Second: line 0, column 10
			expect(result[1].span.start).toEqual({ line: 0, column: 10 });

			// Third: line 1, column 0
			expect(result[2].span.start).toEqual({ line: 1, column: 0 });

			// Fourth: line 1, column 5
			expect(result[3].span.start).toEqual({ line: 1, column: 5 });
		});

		it("should handle already sorted tokens", () => {
			const tokens = [
				createToken(0, 0, 0, 5, ["string"]),
				createToken(0, 5, 0, 10, ["keyword"]),
				createToken(1, 0, 1, 5, ["function"]),
			];
			const result = sortPass.process(tokens);

			expect(result).toEqual(tokens);
		});

		it("should maintain token metadata during sorting", () => {
			const tokens = [
				createToken(1, 5, 1, 10, ["keyword"]),
				createToken(0, 0, 0, 5, ["string"]),
			];
			const result = sortPass.process(tokens);

			// Check that metadata is preserved
			expect(result[0].meta[0].highlightClasses).toEqual(["string"]);
			expect(result[1].meta[0].highlightClasses).toEqual(["keyword"]);
		});
	});

	describe("TokenInfoPass interface compliance", () => {
		it("should ensure MergeTokenPass implements TokenInfoPass", () => {
			const pass: TokenInfoPass = new MergeTokenPass();
			expect(typeof pass.process).toBe("function");
		});

		it("should ensure SortTokenPass implements TokenInfoPass", () => {
			const pass: TokenInfoPass = new SortTokenPass();
			expect(typeof pass.process).toBe("function");
		});
	});

	describe("mergeHighlightClasses utility function", () => {
		it("should return empty array for empty input", () => {
			const result = mergeHighlightClasses([]);
			expect(result).toEqual([]);
		});

		it("should return empty array for array of empty arrays", () => {
			const result = mergeHighlightClasses([[], [], []]);
			expect(result).toEqual([]);
		});

		it("should merge and deduplicate classes", () => {
			const result = mergeHighlightClasses([
				["keyword", "function"],
				["string", "keyword"],
				["comment"],
			]);

			expect(result).toEqual([
				"comment",
				"function",
				"keyword",
				"string",
			]);
		});

		it("should handle duplicate classes within same array", () => {
			const result = mergeHighlightClasses([
				["keyword", "keyword", "function"],
				["keyword"],
			]);

			expect(result).toEqual(["function", "keyword"]);
		});

		it("should return sorted result for consistency", () => {
			const result = mergeHighlightClasses([
				["z-class", "a-class", "m-class"],
			]);

			expect(result).toEqual(["a-class", "m-class", "z-class"]);
		});
	});

	describe("positionToOffset utility function", () => {
		it("should convert position to offset for single line text", () => {
			const text = "Hello world";
			const result = positionToOffset(text, { line: 0, column: 6 });
			expect(result).toBe(6);
		});

		it("should handle multi-line text correctly", () => {
			const text = "Hello\nWorld\nTest";
			// Line 0: "Hello" (5 chars + 1 newline = 6)
			// Line 1: "World" starts at offset 6
			const result = positionToOffset(text, { line: 1, column: 3 });
			expect(result).toBe(9); // 6 + 3
		});

		it("should handle beginning of text", () => {
			const text = "Some text";
			const result = positionToOffset(text, { line: 0, column: 0 });
			expect(result).toBe(0);
		});

		it("should handle end of multi-line text", () => {
			const text = "Line1\nLine2";
			const result = positionToOffset(text, { line: 1, column: 5 });
			expect(result).toBe(11); // 6 (Line1\n) + 5 (Line2)
		});
	});

	describe("offsetToPosition utility function", () => {
		it("should convert offset to position for single line text", () => {
			const text = "Hello world";
			const result = offsetToPosition(text, 6);
			expect(result).toEqual({ line: 0, column: 6 });
		});

		it("should handle multi-line text correctly", () => {
			const text = "Hello\nWorld\nTest";
			const result = offsetToPosition(text, 9);
			expect(result).toEqual({ line: 1, column: 3 });
		});

		it("should handle offset at beginning", () => {
			const text = "Some text";
			const result = offsetToPosition(text, 0);
			expect(result).toEqual({ line: 0, column: 0 });
		});

		it("should handle offset at end of text", () => {
			const text = "Line1\nLine2";
			const result = offsetToPosition(text, 11);
			expect(result).toEqual({ line: 1, column: 5 });
		});

		it("should handle offset that exceeds text length", () => {
			const text = "Short";
			const result = offsetToPosition(text, 100);
			// Should clamp to end of text
			expect(result.line).toBe(0);
			expect(result.column).toBeLessThanOrEqual(text.length);
		});
	});

	describe("Round-trip conversion", () => {
		it("should maintain consistency for positionToOffset -> offsetToPosition", () => {
			const text = "Line1\nLine2\nLine3";
			const originalPos = { line: 1, column: 4 };
			const offset = positionToOffset(text, originalPos);
			const resultPos = offsetToPosition(text, offset);
			expect(resultPos).toEqual(originalPos);
		});

		it("should maintain consistency for offsetToPosition -> positionToOffset", () => {
			const text = "Line1\nLine2\nLine3";
			const originalOffset = 10;
			const pos = offsetToPosition(text, originalOffset);
			const resultOffset = positionToOffset(text, pos);
			expect(resultOffset).toBe(originalOffset);
		});
	});
});
