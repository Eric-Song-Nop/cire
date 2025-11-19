import type { CireConfig, DocGenerator, FileIR, TokenInfo } from "../types";

/**
 * MarkdownGenerator - Generates markdown documentation from source code with syntax highlighting,
 * hover documentation, and definition jumping capabilities using <code> regions instead of markdown code blocks.
 */
class MarkdownGenerator implements DocGenerator {
	constructor(_config: CireConfig) {
		throw new Error("Method not implemented.");
	}
	generate(
		_fileIR: FileIR,
		_info: TokenInfo[],
		_projectRoot: string,
	): string {
		throw new Error("Method not implemented.");
	}
}
export { MarkdownGenerator };
export default MarkdownGenerator;
