/**
 * Unit tests for MergeTokenPass
 *
 * Tests cover:
 * - Basic overlapping token merging
 * - Comment token priority handling
 * - Non-overlapping token preservation
 * - Multiple overlapping tokens with different meta types
 * - Edge cases (empty array, single token, etc.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { TokenInfo } from "../types";
import { MergeTokenPass } from "./MergeTokenPass";

describe("MergeTokenPass", () => {
	// Helper function to create test tokens
	function createToken(
		startLine: number,
		startColumn: number,
		endLine: number,
		endColumn: number,
		metaTypes: string[] = [],
	): TokenInfo {
		const meta = metaTypes.map((type) => {
			if (type === "highlight") {
				return {
					type: "highlight" as const,
					highlightClasses: ["test-class"],
				};
			}
			if (type === "hover") {
				return { type: "hover" as const, content: "test hover" };
			}
			if (type === "comment") {
				return { type: "comment" as const };
			}
			if (type === "symbolDefinition") {
				return {
					type: "symbolDefinition" as const,
					symbolId: "test-symbol-id",
					symbolName: "TestSymbol",
				};
			}
			if (type === "symbolReference") {
				return {
					type: "symbolReference" as const,
					symbolId: "test-symbol-id",
					symbolName: "TestSymbol",
				};
			}
			throw new Error(`Unknown meta type: ${type}`);
		});

		return {
			span: {
				start: { line: startLine, column: startColumn },
				end: { line: endLine, column: endColumn },
			},
			meta,
		};
	}

	let mergePass: MergeTokenPass;

	beforeEach(() => {
		mergePass = new MergeTokenPass();
	});

	describe("process()", () => {
		it("should return empty array for empty input", () => {
			const result = mergePass.process([]);
			expect(result).toEqual([]);
		});

		it("should return single token unchanged", () => {
			const token = createToken(1, 0, 1, 5, ["highlight"]);
			const result = mergePass.process([token]);
			expect(result).toEqual([token]);
		});

		it("should merge overlapping tokens", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 3, 1, 8, ["hover"]);

			const result = mergePass.process([token1, token2]);

			expect(result).toHaveLength(3);
			expect(result[0].span.start).toEqual({ line: 1, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 3 });
			expect(result[1].span.start).toEqual({ line: 1, column: 3 });
			expect(result[1].span.end).toEqual({ line: 1, column: 5 });
			expect(result[2].span.start).toEqual({ line: 1, column: 5 });
			expect(result[2].span.end).toEqual({ line: 1, column: 8 });
		});

		it("should preserve non-overlapping tokens", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 6, 1, 10, ["hover"]);

			const result = mergePass.process([token1, token2]);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual(token1);
			expect(result[1]).toEqual(token2);
		});

		it("should handle multiple overlapping tokens", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 3, 1, 8, ["hover"]);
			const token3 = createToken(1, 6, 1, 12, ["symbolDefinition"]);

			const result = mergePass.process([token1, token2, token3]);

			// Should split overlapping ranges into non-overlapping segments:
			// [0-2]: highlight only
			// [3-4]: highlight + hover
			// [5]: hover only
			// [6-7]: hover + definition
			// [8-11]: definition only
			expect(result).toHaveLength(5);

			// First segment: only highlight
			expect(result[0].span.start).toEqual({ line: 1, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 3 });
			expect(result[0].meta).toHaveLength(1);
			expect(result[0].meta[0].type).toBe("highlight");

			// Second segment: highlight + hover
			expect(result[1].span.start).toEqual({ line: 1, column: 3 });
			expect(result[1].span.end).toEqual({ line: 1, column: 5 });
			expect(result[1].meta).toHaveLength(2);

			// Third segment: hover only
			expect(result[2].span.start).toEqual({ line: 1, column: 5 });
			expect(result[2].span.end).toEqual({ line: 1, column: 6 });
			expect(result[2].meta).toHaveLength(1);
			expect(result[2].meta[0].type).toBe("hover");

			// Fourth segment: hover + definition
			expect(result[3].span.start).toEqual({ line: 1, column: 6 });
			expect(result[3].span.end).toEqual({ line: 1, column: 8 });
			expect(result[3].meta).toHaveLength(2);

			// Fifth segment: definition only
			expect(result[4].span.start).toEqual({ line: 1, column: 8 });
			expect(result[4].span.end).toEqual({ line: 1, column: 12 });
			expect(result[4].meta).toHaveLength(1);
			expect(result[4].meta[0].type).toBe("symbolDefinition");
		});

		it("should handle multiple non-overlapping groups", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 3, 1, 8, ["hover"]);
			const token3 = createToken(1, 10, 1, 15, ["symbolDefinition"]);
			const token4 = createToken(1, 13, 1, 18, ["comment"]);
			// Should split overlapping ranges into non-overlapping segments:
			// [0-3): highlight only
			// [3-5): highlight + hover
			// [5-8): hover only
			// [10-13): definition only
			// [13-15): comment + definition
			// [15-18): comment only

			const result = mergePass.process([token1, token2, token3, token4]);

			expect(result).toHaveLength(6);
		});

		it("should handle tokens on different lines", () => {
			const token1 = createToken(1, 0, 2, 5, ["highlight"]);
			const token2 = createToken(2, 3, 3, 8, ["hover"]);

			const result = mergePass.process([token1, token2]);

			expect(result).toHaveLength(3);
			expect(result[0].span.start).toEqual({ line: 1, column: 0 });
			expect(result[0].span.end).toEqual({ line: 2, column: 3 });
		});

		it("should handle exact adjacent tokens", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 5, 1, 10, ["hover"]);
			// Since we use half-open intervals, these don't overlap:
			// [0-4] highlight only
			// [5-9] hover only

			const result = mergePass.process([token1, token2]);

			expect(result).toHaveLength(2);
			expect(result[0].span.start).toEqual({ line: 1, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 5 });
			expect(result[0].meta).toHaveLength(1);
			expect(result[0].meta[0].type).toBe("highlight");

			expect(result[1].span.start).toEqual({ line: 1, column: 5 });
			expect(result[1].span.end).toEqual({ line: 1, column: 10 });
			expect(result[1].meta).toHaveLength(1);
			expect(result[1].meta[0].type).toBe("hover");
		});
	});

	describe("comment handling (without priority)", () => {
		it("should preserve all meta types including comments", () => {
			const token1 = createToken(1, 0, 1, 5, ["highlight"]);
			const token2 = createToken(1, 3, 1, 8, ["comment"]);
			const token3 = createToken(1, 6, 1, 12, ["hover"]);

			const result = mergePass.process([token1, token2, token3]);

			// Should split into:
			// [0-2]: highlight only
			// [3-4]: highlight + comment
			// [5]: comment only
			// [6-7]: comment + hover
			// [8-11]: hover only
			expect(result).toHaveLength(5);

			// First segment: highlight only
			expect(result[0].span.start).toEqual({ line: 1, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 3 });
			expect(result[0].meta).toHaveLength(1);
			expect(result[0].meta[0].type).toBe("highlight");

			// Second segment: highlight + comment
			expect(result[1].span.start).toEqual({ line: 1, column: 3 });
			expect(result[1].span.end).toEqual({ line: 1, column: 5 });
			expect(result[1].meta).toHaveLength(2);
			const types1 = result[1].meta.map((m) => m.type).sort();
			expect(types1).toEqual(["comment", "highlight"]);

			// Third segment: comment only
			expect(result[2].span.start).toEqual({ line: 1, column: 5 });
			expect(result[2].span.end).toEqual({ line: 1, column: 6 });
			expect(result[2].meta).toHaveLength(1);
			expect(result[2].meta[0].type).toBe("comment");

			// Fourth segment: comment + hover
			expect(result[3].span.start).toEqual({ line: 1, column: 6 });
			expect(result[3].span.end).toEqual({ line: 1, column: 8 });
			expect(result[3].meta).toHaveLength(2);
			const types2 = result[3].meta.map((m) => m.type).sort();
			expect(types2).toEqual(["comment", "hover"]);

			// Fifth segment: hover only
			expect(result[4].span.start).toEqual({ line: 1, column: 8 });
			expect(result[4].span.end).toEqual({ line: 1, column: 12 });
			expect(result[4].meta).toHaveLength(1);
			expect(result[4].meta[0].type).toBe("hover");
		});

		it("should handle multiple overlapping comment tokens", () => {
			const token1 = createToken(1, 0, 1, 5, ["comment"]);
			const token2 = createToken(1, 3, 1, 8, ["highlight"]);
			const token3 = createToken(1, 6, 1, 12, ["comment"]);

			const result = mergePass.process([token1, token2, token3]);

			// Should split into:
			// [0-3): comment only
			// [3-5): comment + highlight
			// [5-6): highlight
			// [6-8): comment + highlight (from second comment token)
			// [8-12]: comment only
			expect(result).toHaveLength(5);
		});
	});
});
