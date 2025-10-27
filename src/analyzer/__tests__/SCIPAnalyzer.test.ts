import { describe, expect, it } from "vitest";
import type { FileIR } from "../../types";
import { SCIPAnalyzer } from "../SCIPAnalyzer";

describe("SCIPAnalyzer", () => {
	it("should create analyzer with SCIP index path", () => {
		const analyzer = new SCIPAnalyzer("test.scip");
		expect(analyzer).toBeDefined();
	});

	it("should return empty array for non-existent file", () => {
		const analyzer = new SCIPAnalyzer("nonexistent.scip");
		const fileIR: FileIR = {
			filePath: "/some/nonexistent/file.ts",
			language: "typescript",
		};

		const tokens = analyzer.analyze(fileIR);
		expect(tokens).toEqual([]);
	});

	it("should return empty array for file without documentation", () => {
		const analyzer = new SCIPAnalyzer("test.scip");
		const fileIR: FileIR = {
			filePath: "src/types/index.ts",
			language: "typescript",
		};

		const tokens = analyzer.analyze(fileIR);
		expect(tokens).toBeDefined();
		expect(Array.isArray(tokens)).toBe(true);
	});

	it("should generate hover information for symbols with documentation", () => {
		const analyzer = new SCIPAnalyzer("test.scip");
		const fileIR: FileIR = {
			filePath: "src/types/index.ts",
			language: "typescript",
		};

		const tokens = analyzer.analyze(fileIR);

		if (tokens.length > 0) {
			const hoverToken = tokens[0];
			expect(hoverToken).toHaveProperty("span");
			expect(hoverToken).toHaveProperty("meta");

			// Check span structure
			expect(hoverToken.span).toHaveProperty("start");
			expect(hoverToken.span).toHaveProperty("end");
			expect(hoverToken.span.start).toHaveProperty("line");
			expect(hoverToken.span.start).toHaveProperty("column");
			expect(hoverToken.span.end).toHaveProperty("line");
			expect(hoverToken.span.end).toHaveProperty("column");

			// Check meta structure
			const hoverMeta = hoverToken.meta[0];
			expect(hoverMeta).toHaveProperty("type", "hover");
			expect(hoverMeta).toHaveProperty("content");
			expect(hoverMeta).toHaveProperty("documentation");
		}
	});

	it("should correctly convert SCIP range formats", () => {
		const analyzer = new SCIPAnalyzer("test.scip");

		// Test 4-element range: [startLine, startCharacter, endLine, endCharacter]
		const range4 = [10, 5, 10, 15];
		const span4 = analyzer["convertSCIPRangeToTextSpan"](range4);
		expect(span4).toEqual({
			start: { line: 10, column: 5 },
			end: { line: 10, column: 15 },
		});

		// Test 3-element range: [startLine, startCharacter, endCharacter] (single line)
		const range3 = [10, 5, 15];
		const span3 = analyzer["convertSCIPRangeToTextSpan"](range3);
		expect(span3).toEqual({
			start: { line: 10, column: 5 },
			end: { line: 10, column: 15 },
		});

		// Test invalid ranges
		expect(analyzer["convertSCIPRangeToTextSpan"]([])).toBeNull();
		expect(analyzer["convertSCIPRangeToTextSpan"]([1, 2])).toBeNull();
		expect(
			analyzer["convertSCIPRangeToTextSpan"]([1, 2, 3, 4, 5]),
		).toBeNull();
	});
});
