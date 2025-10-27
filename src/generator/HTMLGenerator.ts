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
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            font-size: 14px;
            line-height: 1.45;
        }

        code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }

        /* Hoverable token styles */
        .token-hoverable {
            cursor: pointer;
            border-bottom: 1px dotted #6c757d;
            transition: all 0.2s ease;
        }

        .token-hoverable:hover {
            background-color: #e3f2fd;
            border-bottom-color: #2196f3;
        }

        /* Tooltip styles */
        .hover-tooltip {
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Segoe UI', sans-serif;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .hover-tooltip.visible {
            opacity: 1;
        }

        .hover-tooltip .symbol-name {
            font-weight: bold;
            color: #4fc3f7;
            margin-bottom: 4px;
        }

        .hover-tooltip .documentation {
            color: #e0e0e0;
            font-size: 12px;
            white-space: pre-line;
        }

        .hover-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #333 transparent transparent transparent;
        }

        /* Syntax highlighting styles */
        .token-keyword { color: #0066cc; font-weight: bold; }
        .token-string { color: #008000; }
        .token-comment { color: #808080; font-style: italic; }
        .token-number { color: #ff6600; }
        .token-boolean { color: #ff6600; font-weight: bold; }
        .token-function { color: #795da3; }
        .token-type { color: #0086b3; }
        .token-builtin { color: #795da3; font-weight: bold; }
        .token-variable { color: #660066; }
        .token-parameter { color: #660066; font-style: italic; }
        .token-definition { font-weight: bold; border-bottom: 2px solid #ff6600; }
    </style>
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

        function showTooltip(element, content, documentation) {
            clearTimeout(hideTimeout);

            tooltipSymbol.textContent = content;
            tooltipDocs.textContent = documentation || '';

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
