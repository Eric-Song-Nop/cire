import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}"],
		exclude: ["node_modules", "dist", "**/*.d.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.{ts,tsx,js,jsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx,js,jsx}",
				"src/**/*.spec.{ts,tsx,js,jsx}",
				"src/**/*.d.ts",
			],
		},
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
});
