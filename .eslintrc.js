module.exports = {
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
		project: "./tsconfig.json",
	},
	plugins: ["@typescript-eslint"],
	extends: [
		"eslint:recommended",
		"@typescript-eslint/recommended",
		"@typescript-eslint/recommended-requiring-type-checking",
	],
	root: true,
	env: {
		node: true,
		jest: true,
	},
	ignorePatterns: [".eslintrc.js", "dist/", "node_modules/"],
	rules: {
		"@typescript-eslint/interface-name-prefix": "off",
		"@typescript-eslint/explicit-function-return-type": "warn",
		"@typescript-eslint/explicit-module-boundary-types": "warn",
		"@typescript-eslint/no-explicit-any": "warn",
		"@typescript-eslint/no-unused-vars": [
			"error",
			{ argsIgnorePattern: "^_" },
		],
		"@typescript-eslint/prefer-const": "error",
		"prefer-const": "off", // Let TypeScript handle this
	},
};
