import * as fs from "node:fs";
import * as path from "node:path";
import type { CireConfig } from "../types";

interface TreeNode {
	name: string;
	path: string;
	type: "file" | "directory";
	children?: TreeNode[];
	href?: string;
}

/**
 * # Navigation Generator - Creates tree-structured navigation page
 *
 * This is just a temporary solution for index of the generated website.
 * We will be able to fully customize the navigation later with proper template support.
 */
export class NavigationGenerator {
	/**
	 * Build tree structure from file paths
	 */
	private buildTree(files: string[]): TreeNode {
		const root: TreeNode = {
			name: "root",
			path: "",
			type: "directory",
			children: [],
		};

		for (const file of files) {
			const parts = file.split("/").filter((part) => part.length > 0);
			let current = root;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const fullPath = parts.slice(0, i + 1).join("/");
				const isLast = i === parts.length - 1;

				let existingChild = current.children?.find(
					(child) => child.name === part,
				);

				if (!existingChild) {
					existingChild = {
						name: part,
						path: fullPath,
						type: isLast ? "file" : "directory",
						children: isLast ? undefined : [],
					};

					if (!current.children) {
						current.children = [];
					}
					current.children.push(existingChild);
				}

				current = existingChild;
			}
		}

		return root;
	}

	/**
	 * Generate HTML for tree node
	 */
	private generateTreeNodeHTML(node: TreeNode, level: number = 0): string {
		const indent = "  ".repeat(level);
		const isDirectory = node.type === "directory";
		const hasChildren = node.children && node.children.length > 0;

		let html = `${indent}<li class="tree-item">\n`;

		if (isDirectory) {
			html += `${indent}  <div class="tree-node tree-directory" data-level="${level}" style="color: #1a202c !important;">\n`;
			html += `${indent}    <span class="tree-icon" style="color: #0969da !important;">📁</span>\n`;
			html += `${indent}    <span class="tree-label" style="color: #1a202c !important; font-weight: 600 !important;">${node.name}</span>\n`;
			html += `${indent}  </div>\n`;

			if (hasChildren) {
				html += `${indent}  <ul class="tree-children">\n`;
				// Sort: directories first, then files, both alphabetically
				const sortedChildren = [...(node.children || [])].sort(
					(a, b) => {
						if (a.type !== b.type) {
							return a.type === "directory" ? -1 : 1;
						}
						return a.name.localeCompare(b.name);
					},
				);

				for (const child of sortedChildren) {
					html += this.generateTreeNodeHTML(child, level + 1);
				}
				html += `${indent}  </ul>\n`;
			}
		} else {
			// File node
			const href = node.path.replace(/\.ts$/, ".html");
			const extension = path.extname(node.name);
			let icon = "📄";

			if (extension === ".ts") {
				icon = "📘";
			} else if (extension === ".js") {
				icon = "📜";
			} else if (extension === ".json" || extension === ".json5") {
				icon = "⚙";
			}

			html += `${indent}  <div class="tree-node tree-file" data-level="${level}" style="color: #2d3748 !important;">\n`;
			html += `${indent}    <span class="tree-icon" style="color: #656d76 !important;">${icon}</span>\n`;
			html += `${indent}    <a href="${href}" class="tree-link" style="color: #2d3748 !important; font-weight: 500 !important; font-size: 1rem !important;">${node.name}</a>\n`;
			html += `${indent}  </div>\n`;
		}

		html += `${indent}</li>\n`;
		return html;
	}

	/**
	 * Generate complete navigation page HTML
	 */
	generateNavigationPage(files: string[], config: CireConfig): string {
		const tree = this.buildTree(files);
		const totalFiles = files.length;
		const directories = new Set(files.map((f) => path.dirname(f))).size;

		const treeHTML = tree.children
			? tree.children
					.map((child) => this.generateTreeNodeHTML(child))
					.join("")
			: "<li><p>No files found</p></li>";

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name} - Documentation</title>
    <link rel="stylesheet" href="./default.css">
    <style>
        /* Tree Navigation Styles */
        body {
            background-color: #ffffff !important;
        }

        .container {
            background-color: #ffffff !important;
        }
        .navigation-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .site-header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid var(--border-color, #e1e5e9);
        }

        .site-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a202c !important;
            margin-bottom: 0.5rem;
        }

        .site-description {
            font-size: 1.25rem;
            color: #2d3748 !important;
            margin-bottom: 1rem;
        }

        .site-stats {
            display: flex;
            justify-content: center;
            gap: 2rem;
            font-size: 1.1rem;
            color: #2d3748 !important;
        }

        .stat-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .tree-navigation {
            background: var(--bg-color, #ffffff);
            border: 1px solid var(--border-color, #e1e5e9);
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .tree-navigation ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .tree-item {
            margin: 0;
        }

        .tree-children {
            margin-left: 1.5rem;
            position: relative;
        }

        .tree-children::before {
            content: "";
            position: absolute;
            left: -0.75rem;
            top: 0;
            bottom: 0;
            width: 1px;
            background: var(--border-color, #e1e5e9);
        }

        .tree-node {
            display: flex;
            align-items: center;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            transition: background-color 0.15s ease;
            cursor: pointer;
        }

        .tree-node:hover {
            background-color: var(--hover-bg-color, #f6f8fa);
        }

        .tree-icon {
            margin-right: 0.75rem;
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .tree-label {
            font-weight: 600;
            color: #1a202c !important;
        }

        .tree-link {
            color: #2d3748 !important;
            text-decoration: none;
            font-weight: 500;
            font-size: 1rem;
        }

        .tree-link:hover {
            color: var(--link-color, #0969da);
            text-decoration: underline;
        }

        .tree-directory .tree-icon {
            color: var(--directory-color, #0969da);
        }

        .tree-file .tree-icon {
            color: var(--file-color, #656d76);
        }

        .footer {
            text-align: center;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color, #e1e5e9);
            color: #2d3748 !important;
            font-size: 0.9rem;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .site-title,
            .tree-label,
            .tree-link {
                color: var(--text-color, #f0f6fc);
            }

            .site-description,
            .site-stats,
            .footer {
                color: var(--text-secondary-color, #8b949e);
            }
        }

        /* Responsive design */
        @media (max-width: 768px) {
            .navigation-container {
                padding: 1rem;
            }

            .site-title {
                font-size: 2rem;
            }

            .site-stats {
                flex-direction: column;
                gap: 0.5rem;
            }

            .tree-children {
                margin-left: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="navigation-container">
            <header class="site-header">
                <h1 class="site-title">${config.name}</h1>
                <p class="site-description">${config.description || "Static website generator providing IDE-like experiences for documentation, <a href='https://github.com/Eric-Song-Nop/cire'>Cire</a>"}</p>
                <div class="site-stats">
                    <div class="stat-item">
                        <span>📁</span>
                        <span>${directories} directories</span>
                    </div>
                    <div class="stat-item">
                        <span>📄</span>
                        <span>${totalFiles} files</span>
                    </div>
                    <div class="stat-item">
                        <span>🔤</span>
                        <span>${config.input.language}</span>
                    </div>
                </div>
            </header>

            <main class="tree-navigation">
                <ul>
                    ${treeHTML}
                </ul>
            </main>

            <footer class="footer">
                <p>Generated with <a href="https://github.com/Eric-Song-Nop/cire">Cire</a> •
                   Version ${config.version} •
                   Built on ${new Date().toLocaleDateString()}</p>
            </footer>
        </div>
    </div>

    <script>
        // Interactive tree functionality
        document.addEventListener('DOMContentLoaded', function() {
            const treeNodes = document.querySelectorAll('.tree-directory');

            treeNodes.forEach(node => {
                node.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const parentLi = this.parentElement;
                    const children = parentLi.querySelector('.tree-children');

                    if (children) {
                        const isHidden = children.style.display === 'none';
                        children.style.display = isHidden ? 'block' : 'none';

                        // Update icon
                        const icon = this.querySelector('.tree-icon');
                        if (icon) {
                            icon.textContent = isHidden ? '📁' : '📂';
                        }
                    }
                });
            });

            // Add keyboard navigation
            const treeItems = Array.from(document.querySelectorAll('.tree-node'));
            let currentIndex = -1;

            document.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    currentIndex = Math.min(currentIndex + 1, treeItems.length - 1);
                    treeItems[currentIndex]?.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    currentIndex = Math.max(currentIndex - 1, 0);
                    treeItems[currentIndex]?.focus();
                }
            });
        });
    </script>
</body>
</html>`;
	}

	/**
	 * Save navigation page to output directory
	 */
	async saveNavigationPage(html: string, outputDir: string): Promise<void> {
		const indexPath = path.join(outputDir, "cireIndex.html");
		fs.writeFileSync(indexPath, html, "utf-8");
	}
}
