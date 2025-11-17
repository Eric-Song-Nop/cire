/**
 * Escape markdown special characters to prevent rendering issues
 */
export function escapeMarkdown(text: string): string {
	// Escape markdown special characters but preserve code structure
	// CRITICAL: Do NOT escape hyphens at all - they are too problematic in code
	return text
		.replace(/\\/g, "\\\\") // Escape backslashes first
		.replace(/`/g, "\\`") // Escape backticks
		.replace(/\*/g, "\\*") // Escape asterisks
		.replace(/_/g, "\\_") // Escape underscores
		.replace(/\{/g, "\\{") // Escape curly braces
		.replace(/\}/g, "\\}") // Escape curly braces
		.replace(/\[/g, "\\[") // Escape square brackets
		.replace(/\]/g, "\\]") // Escape square brackets
		.replace(/\(/g, "\\(") // Escape parentheses
		.replace(/\)/g, "\\)") // Escape parentheses
		.replace(/#/g, "\\#") // Escape hash symbols
		.replace(/\+/g, "\\+") // Escape plus signs
		.replace(/\./g, "\\.") // Escape periods
		.replace(/!/g, "\\!"); // Escape exclamation marks
}

/**
 * Escape HTML special characters for content inside <pre><code> blocks and HTML attributes
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
