import * as fs from "node:fs";
import * as path from "node:path";
import { match } from "ts-pattern";
import type { DocGenerator, FileIR, Position, TokenInfo } from "../types";

/**
 * We turn the source code with Highlight Info into HTML
 * Only syntax highlighting is considered - hover and definition are ignored for now
 */
class HTMLGenerator implements DocGenerator {
	/**
	 * Convert position to character offset in source text
	 */
	private positionToOffset(text: string, pos: Position): number {
		const lines = text.split("\n");
		let offset = 0;

		for (let i = 0; i < pos.line; i++) {
			offset += lines[i].length + 1; // +1 for newline
		}

		return offset + pos.column;
	}

	/**
	 * Sort tokens by start position to ensure correct processing order
	 */
	private sortTokens(tokens: TokenInfo[]): TokenInfo[] {
		return tokens.sort((a, b) => {
			if (a.span.start.line !== b.span.start.line) {
				return a.span.start.line - b.span.start.line;
			}
			return a.span.start.column - b.span.start.column;
		});
	}

	/**
	 * Escape HTML special characters to prevent rendering issues
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Extract token information including classes and hover data
	 */
	private extractTokenInfo(meta: TokenInfo["meta"]): {
		classes: string[];
		hoverContent?: string;
		hoverDocumentation?: string;
	} {
		const classes: string[] = [];
		let hoverContent: string | undefined;
		let hoverDocumentation: string | undefined;

		meta.forEach((m) => {
			match(m)
				.with({ type: "highlight" }, (m) => {
					classes.push(...m.highlightClasses);
				})
				.with({ type: "hover" }, (m) => {
					classes.push("token-hoverable");
					hoverContent = m.content;
					hoverDocumentation = m.documentation;
				})
				.with({ type: "definition" }, () => {
					classes.push("token-definition");
				})
				.exhaustive();
		});

		return {
			classes,
			hoverContent,
			hoverDocumentation,
		};
	}

	/**
	 * Generate HTML from FileIR and TokenInfo
	 */
	generate(fileIR: FileIR, info: TokenInfo[]): string {
		try {
			// Read source file content
			const sourcePath = path.resolve(fileIR.filePath);
			if (!fs.existsSync(sourcePath)) {
				throw new Error(`Source file not found: ${sourcePath}`);
			}

			const sourceContent = fs.readFileSync(sourcePath, "utf-8");

			// Process all tokens (including those with hover info)
			const sortedTokens = this.sortTokens(info);

			// Generate HTML with syntax highlighting
			const htmlContent = this.generateHighlightedHTML(
				sourceContent,
				sortedTokens,
			);

			return this.wrapInHTMLTemplate(fileIR, htmlContent);
		} catch (error) {
			throw new Error(
				`Failed to generate HTML for ${fileIR.filePath}: ${error}`,
			);
		}
	}

	/**
	 * Generate HTML with highlighted tokens, preserving all source text
	 */
	private generateHighlightedHTML(
		sourceContent: string,
		tokens: TokenInfo[],
	): string {
		if (tokens.length === 0) {
			// No highlight tokens, just escape and wrap in pre/code
			return `<pre><code>${this.escapeHtml(sourceContent)}</code></pre>`;
		}

		let result = "";
		let currentOffset = 0;

		// Process tokens in order
		for (const token of tokens) {
			const tokenStart = this.positionToOffset(
				sourceContent,
				token.span.start,
			);
			const tokenEnd = this.positionToOffset(
				sourceContent,
				token.span.end,
			);

			// Add text before token (unhighlighted but preserved)
			if (tokenStart > currentOffset) {
				const textBefore = sourceContent.slice(
					currentOffset,
					tokenStart,
				);
				result += this.escapeHtml(textBefore);
			}

			// Add token with CSS classes and hover data
			const tokenText = sourceContent.slice(tokenStart, tokenEnd);
			const tokenInfo = this.extractTokenInfo(token.meta);

			if (tokenInfo.classes.length > 0 || tokenInfo.hoverContent) {
				const classAttr =
					tokenInfo.classes.length > 0
						? ` class="${tokenInfo.classes.join(" ")}"`
						: "";

				let dataAttrs = "";
				if (tokenInfo.hoverContent) {
					dataAttrs += ` data-hover-content="${this.escapeHtml(tokenInfo.hoverContent)}"`;
					if (tokenInfo.hoverDocumentation) {
						dataAttrs += ` data-hover-documentation="${this.escapeHtml(tokenInfo.hoverDocumentation)}"`;
					}
				}

				result += `<span${classAttr}${dataAttrs}>${this.escapeHtml(tokenText)}</span>`;
			} else {
				// No classes or hover info, just escape the text
				result += this.escapeHtml(tokenText);
			}

			currentOffset = tokenEnd;
		}

		// Add remaining text after last token
		if (currentOffset < sourceContent.length) {
			const remainingText = sourceContent.slice(currentOffset);
			result += this.escapeHtml(remainingText);
		}

		return `<pre><code>${result}</code></pre>`;
	}

	/**
	 * Wrap content in HTML template with hover support
	 */
	private wrapInHTMLTemplate(fileIR: FileIR, content: string): string {
		const fileName = path.basename(fileIR.filePath);
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName} - Cire Documentation</title>
    <link rel="stylesheet" href="./default.css">
</head>
<body>
    <div class="container">
        <h1>${fileName}</h1>
        <p>Generated by <strong>Cire</strong> - Static Documentation Generator with IDE-like features</p>
        <div>
            ${content}
        </div>
    </div>

    <div class="hover-tooltip" id="tooltip">
        <div class="symbol-name" id="tooltip-symbol"></div>
        <div class="documentation" id="tooltip-docs"></div>
    </div>

    <script>
        const tooltip = document.getElementById('tooltip');
        const tooltipSymbol = document.getElementById('tooltip-symbol');
        const tooltipDocs = document.getElementById('tooltip-docs');
        let hideTimeout;

        function parseMarkdown(text) {
            if (!text) return '';

            return text
                // Code blocks
                .replace(/\\\`\\\`\\\`\\w+\\n([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>')
                // Inline code
                .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>')
                // Bold text
                .replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>')
                // Italic text
                .replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>')
                // Headers (simplified for tooltips)
                .replace(/^### (.*$)/gim, '<strong>$1</strong>')
                .replace(/^## (.*$)/gim, '<strong>$1</strong>')
                .replace(/^# (.*$)/gim, '<strong>$1</strong>')
                // Unordered lists
                .replace(/^\\* (.+)/gim, '<li>$1</li>')
                // Ordered lists
                .replace(/^\\d+\\. (.+)/gim, '<li>$1</li>')
                // Wrap list items in list tags
                .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
                // Paragraphs (replace double newlines with paragraph tags)
                .replace(/\\n\\n/g, '</p><p>')
                .replace(/^/, '<p>')
                .replace(/$/, '</p>')
                // Clean up any extra paragraphs
                .replace(/<p><\\/p>/g, '')
                .replace(/<p>(<strong>)/g, '$1')
                .replace(/(<\\/strong>)<\\/p>/g, '$1')
                .replace(/<p>(<ul>)/g, '$1')
                .replace(/(<\\/ul>)<\\/p>/g, '$1')
                .replace(/<p>(<pre>)/g, '$1')
                .replace(/(<\\/pre>)<\\/p>/g, '$1');
        }

        function showTooltip(element, content, documentation) {
            clearTimeout(hideTimeout);

            tooltipSymbol.textContent = content;
            tooltipDocs.innerHTML = parseMarkdown(documentation || '');

            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 10;

            // Keep tooltip within viewport
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }
            if (top < 10) {
                top = rect.bottom + 10;
            }

            tooltip.style.left = left + window.scrollX + 'px';
            tooltip.style.top = top + window.scrollY + 'px';

            tooltip.classList.add('visible');
        }

        function hideTooltip() {
            hideTimeout = setTimeout(() => {
                tooltip.classList.remove('visible');
            }, 100);
        }

        // Add hover listeners to all hoverable tokens
        document.addEventListener('DOMContentLoaded', () => {
            const hoverableElements = document.querySelectorAll('[data-hover-content]');

            hoverableElements.forEach(element => {
                const content = element.getAttribute('data-hover-content');
                const documentation = element.getAttribute('data-hover-documentation');

                element.addEventListener('mouseenter', (e) => {
                    showTooltip(e.target, content, documentation);
                });

                element.addEventListener('mouseleave', hideTooltip);
            });

            // Hide tooltip when clicking elsewhere
            document.addEventListener('click', hideTooltip);
        });
    </script>
</body>
</html>`;
	}
}

export { HTMLGenerator };
export default HTMLGenerator;
