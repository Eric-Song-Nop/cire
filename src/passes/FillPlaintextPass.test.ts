/**
 * Unit tests for FillPlaintextPass
 *
 * Tests cover:
 * - Basic gap filling between tokens
 * - Empty input handling
 * - Single token handling with end-of-file plaintext
 * - Multiple tokens on same line with gaps
 * - Multi-line tokens and gaps
 * - Edge cases: adjacent tokens, file start/end gaps
 * - Complex scenarios with mixed token positions
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { TokenInfo } from "../types";
import { FillPlaintextPass } from "./FillPlaintextPass";

describe("FillPlaintextPass", () => {
	// Helper function to create test tokens
	function createToken(
		startLine: number,
		startColumn: number,
		endLine: number,
		endColumn: number,
		metaTypes: string[] = ["highlight"],
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

	let fillPass: FillPlaintextPass;

	beforeEach(() => {
		fillPass = new FillPlaintextPass();
	});

	describe("process()", () => {
		it("should return empty array for empty input", () => {
			const result = fillPass.process([]);
			expect(result).toEqual([]);
		});

		it("should add plaintext before first token if it doesn't start at (0,0)", () => {
			const token = createToken(0, 5, 0, 10, ["highlight"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(3);

			// First token should be plaintext from (0,0) to (0,5)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 5 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Second token should be the original token
			expect(result[1]).toEqual(token);

			// Third token should be plaintext to end of file
			expect(result[2].span.start).toEqual({ line: 0, column: 10 });
			expect(result[2].span.end).toEqual({ line: -1, column: -1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should add plaintext after last token to end of file", () => {
			const token = createToken(0, 2, 0, 7, ["highlight"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(3);

			// First token should be plaintext from (0,0) to (0,2)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 2 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Second token should be the original token
			expect(result[1]).toEqual(token);

			// Third token should be plaintext from (0,7) to end of file
			expect(result[2].span.start).toEqual({ line: 0, column: 7 });
			expect(result[2].span.end).toEqual({ line: -1, column: -1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should fill gaps between adjacent tokens on same line", () => {
			const token1 = createToken(0, 2, 0, 5, ["highlight"]);
			const token2 = createToken(0, 8, 0, 12, ["hover"]);

			const result = fillPass.process([token1, token2]);

			expect(result).toHaveLength(5);

			// Plaintext from start to first token
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 2 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// First token
			expect(result[1]).toEqual(token1);

			// Plaintext gap between tokens
			expect(result[2].span.start).toEqual({ line: 0, column: 5 });
			expect(result[2].span.end).toEqual({ line: 0, column: 8 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);

			// Second token
			expect(result[3]).toEqual(token2);

			// Final plaintext to end of file
			expect(result[4].span.start).toEqual({ line: 0, column: 12 });
			expect(result[4].span.end).toEqual({ line: -1, column: -1 });
			expect(result[4].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle tokens that start at (0,0) without leading plaintext", () => {
			const token = createToken(0, 0, 0, 5, ["highlight"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(2);

			// First token should be the original token (no leading plaintext)
			expect(result[0]).toEqual(token);

			// Second token should be plaintext to end of file
			expect(result[1].span.start).toEqual({ line: 0, column: 5 });
			expect(result[1].span.end).toEqual({ line: -1, column: -1 });
			expect(result[1].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle multiple tokens with multiple gaps on same line", () => {
			const token1 = createToken(0, 0, 0, 3, ["highlight"]);
			const token2 = createToken(0, 6, 0, 9, ["hover"]);
			const token3 = createToken(0, 12, 0, 15, ["symbolDefinition"]);

			const result = fillPass.process([token1, token2, token3]);

			expect(result).toHaveLength(6);

			// First token (starts at 0,0, no leading plaintext)
			expect(result[0]).toEqual(token1);

			// Gap between token1 and token2
			expect(result[1].span.start).toEqual({ line: 0, column: 3 });
			expect(result[1].span.end).toEqual({ line: 0, column: 6 });
			expect(result[1].meta).toEqual([{ type: "plaintext" }]);

			// Second token
			expect(result[2]).toEqual(token2);

			// Gap between token2 and token3
			expect(result[3].span.start).toEqual({ line: 0, column: 9 });
			expect(result[3].span.end).toEqual({ line: 0, column: 12 });
			expect(result[3].meta).toEqual([{ type: "plaintext" }]);

			// Third token
			expect(result[4]).toEqual(token3);

			// Final plaintext to end of file
			expect(result[5].span.start).toEqual({ line: 0, column: 15 });
			expect(result[5].span.end).toEqual({ line: -1, column: -1 });
			expect(result[5].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle multi-line tokens and gaps", () => {
			const token1 = createToken(0, 2, 1, 3, ["highlight"]); // Spans multiple lines
			const token2 = createToken(2, 1, 2, 5, ["hover"]);

			const result = fillPass.process([token1, token2]);

			expect(result).toHaveLength(5);

			// Leading plaintext from (0,0) to (0,2)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 2 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// First multi-line token
			expect(result[1]).toEqual(token1);

			// Gap between tokens (from line 1, column 3 to line 2, column 1)
			expect(result[2].span.start).toEqual({ line: 1, column: 3 });
			expect(result[2].span.end).toEqual({ line: 2, column: 1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);

			// Second token
			expect(result[3]).toEqual(token2);

			// Final plaintext to end of file
			expect(result[4].span.start).toEqual({ line: 2, column: 5 });
			expect(result[4].span.end).toEqual({ line: -1, column: -1 });
			expect(result[4].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle adjacent tokens without creating gaps", () => {
			const token1 = createToken(0, 2, 0, 5, ["highlight"]);
			const token2 = createToken(0, 5, 0, 8, ["hover"]); // Starts exactly where token1 ends

			const result = fillPass.process([token1, token2]);

			expect(result).toHaveLength(4);

			// Leading plaintext
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 2 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// First token
			expect(result[1]).toEqual(token1);

			// Second token (no gap between)
			expect(result[2]).toEqual(token2);

			// Final plaintext to end of file
			expect(result[3].span.start).toEqual({ line: 0, column: 8 });
			expect(result[3].span.end).toEqual({ line: -1, column: -1 });
			expect(result[3].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle complex multi-line scenario", () => {
			const token1 = createToken(0, 1, 0, 4, ["highlight"]);
			const token2 = createToken(1, 2, 1, 6, ["hover"]);
			const token3 = createToken(2, 0, 2, 3, ["symbolDefinition"]);

			const result = fillPass.process([token1, token2, token3]);

			expect(result).toHaveLength(7);

			// Leading plaintext (0,0) to (0,1)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 1 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Token1
			expect(result[1]).toEqual(token1);

			// Gap from (0,4) to (1,2) - spans end of line 0 and start of line 1
			expect(result[2].span.start).toEqual({ line: 0, column: 4 });
			expect(result[2].span.end).toEqual({ line: 1, column: 2 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);

			// Token2
			expect(result[3]).toEqual(token2);

			// Gap from (1,6) to (2,0)
			expect(result[4].span.start).toEqual({ line: 1, column: 6 });
			expect(result[4].span.end).toEqual({ line: 2, column: 0 });
			expect(result[4].meta).toEqual([{ type: "plaintext" }]);

			// Token3 (starts at line 2, column 0, no gap from previous line end)
			expect(result[5]).toEqual(token3);

			// Final plaintext to end of file
			expect(result[6].span.start).toEqual({ line: 2, column: 3 });
			expect(result[6].span.end).toEqual({ line: -1, column: -1 });
			expect(result[6].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle tokens with multiple meta types", () => {
			const token = createToken(0, 3, 0, 8, ["highlight", "hover"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(3);

			// Leading plaintext
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 3 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Token with multiple meta types should be preserved
			expect(result[1]).toEqual(token);

			// Final plaintext to end of file
			expect(result[2].span.start).toEqual({ line: 0, column: 8 });
			expect(result[2].span.end).toEqual({ line: -1, column: -1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle tokens that are already sorted", () => {
			const token1 = createToken(0, 0, 0, 2, ["highlight"]);
			const token2 = createToken(0, 5, 0, 7, ["hover"]);
			const token3 = createToken(0, 10, 0, 12, ["symbolDefinition"]);

			const result = fillPass.process([token1, token2, token3]);

			expect(result).toHaveLength(6);

			// Token1 (no leading plaintext)
			expect(result[0]).toEqual(token1);

			// Gap
			expect(result[1].span.start).toEqual({ line: 0, column: 2 });
			expect(result[1].span.end).toEqual({ line: 0, column: 5 });
			expect(result[1].meta).toEqual([{ type: "plaintext" }]);

			// Token2
			expect(result[2]).toEqual(token2);

			// Gap
			expect(result[3].span.start).toEqual({ line: 0, column: 7 });
			expect(result[3].span.end).toEqual({ line: 0, column: 10 });
			expect(result[3].meta).toEqual([{ type: "plaintext" }]);

			// Token3
			expect(result[4]).toEqual(token3);

			// Final plaintext to end of file
			expect(result[5].span.start).toEqual({ line: 0, column: 12 });
			expect(result[5].span.end).toEqual({ line: -1, column: -1 });
			expect(result[5].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should preserve token order and metadata exactly", () => {
			const token1 = createToken(1, 2, 1, 5, ["hover"]);
			const token2 = createToken(1, 8, 2, 3, ["symbolDefinition"]);

			const result = fillPass.process([token1, token2]);

			expect(result).toHaveLength(5);

			// Leading plaintext from (0,0) to (1,2)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 2 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Original tokens should be preserved exactly
			expect(result[1]).toEqual(token1);
			expect(result[3]).toEqual(token2);

			// Gap should have correct span
			expect(result[2].span.start).toEqual({ line: 1, column: 5 });
			expect(result[2].span.end).toEqual({ line: 1, column: 8 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);

			// Final plaintext to end of file
			expect(result[4].span.start).toEqual({ line: 2, column: 3 });
			expect(result[4].span.end).toEqual({ line: -1, column: -1 });
			expect(result[4].meta).toEqual([{ type: "plaintext" }]);
		});
	});

	describe("edge cases", () => {
		it("should handle single token at file start", () => {
			const token = createToken(0, 0, 0, 1, ["highlight"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual(token);
			expect(result[1].span.start).toEqual({ line: 0, column: 1 });
			expect(result[1].span.end).toEqual({ line: -1, column: -1 });
		});

		it("should handle token starting at line > 0", () => {
			const token = createToken(3, 5, 3, 10, ["highlight"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(3);

			// Should create plaintext from (0,0) to (3,5)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 3, column: 5 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			expect(result[1]).toEqual(token);

			// Final plaintext to end of file
			expect(result[2].span.start).toEqual({ line: 3, column: 10 });
			expect(result[2].span.end).toEqual({ line: -1, column: -1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);
		});

		it("should handle tokens with zero-length spans", () => {
			const token = createToken(1, 5, 1, 5, ["hover"]);
			const result = fillPass.process([token]);

			expect(result).toHaveLength(3);

			// Leading plaintext from (0,0) to (1,5)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 5 });
			expect(result[0].meta).toEqual([{ type: "plaintext" }]);

			// Zero-length token
			expect(result[1]).toEqual(token);

			// Trailing plaintext
			expect(result[2].span.start).toEqual({ line: 1, column: 5 });
			expect(result[2].span.end).toEqual({ line: -1, column: -1 });
			expect(result[2].meta).toEqual([{ type: "plaintext" }]);
		});
	});
});
