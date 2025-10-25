# Cire

`Cire` is a static website generator implemented in `TypeScript`,
that supports an IDE like experience for static website.

## Technical Details

This project utilizes both [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) and [LSIF](https://lsif.dev/)/[SCIP](https://github.com/sourcegraph/scip) for source code analysis.

- tree-sitter for syntax highlighting.
- LSIF/SCIP for embeding lsp info into generated html.

The input of this static website generator is just a normal codebase of any language supported by tree-sitter and LSIF/SCIP.
We first manually run LSIF/SCIP generator to generate LSIF/SCIP index for the project, then generate website from the index file and source code.

First we run tree-sitter to separate block comments or blocks of normal comments from other code or comment.
Then for source code, we run two passes: tree-sitter for highlighting, then use SCIP for lsp info.
Therefore we can get an array of ir with all highlighting and lsp info.
From the ir we can generate the final website file.

