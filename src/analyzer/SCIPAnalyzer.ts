import type { Analyzer, FileIR, TokenInfo } from "../types";

class SCIPAnayzer implements Analyzer {
	analyze(fileIR: FileIR): TokenInfo[] {
		throw new Error("Method not implemented.");
	}
}
