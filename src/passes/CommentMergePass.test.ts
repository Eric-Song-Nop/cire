/**
 * CommentMergePass Unit Tests
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { TokenInfo } from "../types";
import { CommentMergePass } from "./CommentMergePass";

describe("CommentMergePass", () => {
	let commentMergePass: CommentMergePass;

	beforeEach(() => {
		commentMergePass = new CommentMergePass();
	});

	describe("prioritizeCommentMeta", () => {
		it("should keep only comment meta when token has comment and other meta", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "comment" },
						{ type: "highlight", highlightClasses: ["keyword"] },
						{ type: "hover", content: "test" },
					],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].meta).toEqual([{ type: "comment" }]);
		});

		it("should keep token unchanged when it has no comment meta", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "highlight", highlightClasses: ["keyword"] },
						{ type: "hover", content: "test" },
					],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].meta).toEqual(tokens[0].meta);
		});

		it("should keep only one comment meta when token has multiple comment meta", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "comment" },
						{ type: "comment" },
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].meta).toEqual([{ type: "comment" }]);
		});

		it("should handle mixed tokens correctly", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
				{
					span: {
						start: { line: 0, column: 6 },
						end: { line: 0, column: 10 },
					},
					meta: [
						{ type: "comment" },
						{ type: "hover", content: "test" },
					],
				},
				{
					span: {
						start: { line: 0, column: 11 },
						end: { line: 0, column: 15 },
					},
					meta: [
						{
							type: "symbolDefinition",
							symbolId: "test-symbol-1",
							symbolName: "TestSymbol",
						},
					],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(3);
			expect(result[0].meta).toEqual([
				{ type: "highlight", highlightClasses: ["keyword"] },
			]);
			expect(result[1].meta).toEqual([{ type: "comment" }]);
			expect(result[2].meta).toEqual([
				{
					type: "symbolDefinition",
					symbolId: "test-symbol-1",
					symbolName: "TestSymbol",
				},
			]);
		});
	});

	describe("mergeAdjacentComments", () => {
		it("should merge adjacent comment tokens into single token", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 5 },
						end: { line: 0, column: 10 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 10 },
						end: { line: 0, column: 15 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 15 });
			expect(result[0].meta).toEqual([{ type: "comment" }]);
		});

		it("should not merge non-adjacent comment tokens", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 7 }, // Gap of 2 columns
						end: { line: 0, column: 12 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(2);
			expect(result[0].span).toEqual(tokens[0].span);
			expect(result[1].span).toEqual(tokens[1].span);
		});

		it("should merge only adjacent groups and keep separate groups separate", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 5 },
						end: { line: 0, column: 10 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 12 }, // Gap
						end: { line: 0, column: 17 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 17 },
						end: { line: 0, column: 22 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(2);
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 10 });
			expect(result[1].span.start).toEqual({ line: 0, column: 12 });
			expect(result[1].span.end).toEqual({ line: 0, column: 22 });
		});

		it("should preserve non-comment tokens between comment groups", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 5 },
						end: { line: 0, column: 10 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 10 },
						end: { line: 0, column: 15 },
					},
					meta: [
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
				{
					span: {
						start: { line: 0, column: 15 },
						end: { line: 0, column: 20 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 20 },
						end: { line: 0, column: 25 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(3);
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 10 });
			expect(result[0].meta).toEqual([{ type: "comment" }]);

			expect(result[1].span.start).toEqual({ line: 0, column: 10 });
			expect(result[1].span.end).toEqual({ line: 0, column: 15 });
			expect(result[1].meta).toEqual([
				{ type: "highlight", highlightClasses: ["keyword"] },
			]);

			expect(result[2].span.start).toEqual({ line: 0, column: 15 });
			expect(result[2].span.end).toEqual({ line: 0, column: 25 });
			expect(result[2].meta).toEqual([{ type: "comment" }]);
		});

		it("should handle multi-line adjacent comments", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 10 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 10 },
						end: { line: 1, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 1, column: 5 },
						end: { line: 1, column: 15 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(1);
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 1, column: 15 });
			expect(result[0].meta).toEqual([{ type: "comment" }]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty array", () => {
			const result = commentMergePass.process([]);
			expect(result).toEqual([]);
		});

		it("should handle single comment token", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);
			expect(result).toEqual(tokens);
		});

		it("should handle single non-comment token", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
			];

			const result = commentMergePass.process(tokens);
			expect(result).toEqual(tokens);
		});

		it("should handle tokens with empty meta array", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [],
				},
			];

			const result = commentMergePass.process(tokens);
			expect(result).toEqual(tokens);
		});
	});

	describe("integration tests", () => {
		it("should handle complex scenario with prioritization and merging", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "comment" },
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
				{
					span: {
						start: { line: 0, column: 5 },
						end: { line: 0, column: 10 },
					},
					meta: [
						{ type: "comment" },
						{ type: "hover", content: "test" },
					],
				},
				{
					span: {
						start: { line: 0, column: 10 },
						end: { line: 0, column: 15 },
					},
					meta: [{ type: "highlight", highlightClasses: ["string"] }],
				},
				{
					span: {
						start: { line: 0, column: 20 },
						end: { line: 0, column: 25 },
					},
					meta: [{ type: "comment" }],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(3);

			// First merged comment (0-10)
			expect(result[0].span.start).toEqual({ line: 0, column: 0 });
			expect(result[0].span.end).toEqual({ line: 0, column: 10 });
			expect(result[0].meta).toEqual([{ type: "comment" }]);

			// Highlight token (10-15)
			expect(result[1].span.start).toEqual({ line: 0, column: 10 });
			expect(result[1].span.end).toEqual({ line: 0, column: 15 });
			expect(result[1].meta).toEqual([
				{ type: "highlight", highlightClasses: ["string"] },
			]);

			// Single comment token (20-25)
			expect(result[2].span.start).toEqual({ line: 0, column: 20 });
			expect(result[2].span.end).toEqual({ line: 0, column: 25 });
			expect(result[2].meta).toEqual([{ type: "comment" }]);
		});

		it("should maintain original token order", () => {
			const tokens: TokenInfo[] = [
				{
					span: {
						start: { line: 0, column: 0 },
						end: { line: 0, column: 5 },
					},
					meta: [
						{ type: "highlight", highlightClasses: ["keyword"] },
					],
				},
				{
					span: {
						start: { line: 0, column: 6 },
						end: { line: 0, column: 10 },
					},
					meta: [{ type: "comment" }],
				},
				{
					span: {
						start: { line: 0, column: 11 },
						end: { line: 0, column: 15 },
					},
					meta: [
						{
							type: "symbolDefinition",
							symbolId: "test-symbol-1",
							symbolName: "TestSymbol",
						},
					],
				},
			];

			const result = commentMergePass.process(tokens);

			expect(result).toHaveLength(3);
			expect(result[0].span.start.column).toBe(0);
			expect(result[1].span.start.column).toBe(6);
			expect(result[2].span.start.column).toBe(11);
		});
	});
});
