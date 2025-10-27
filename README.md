# Cire

`Cire` is a static website generator implemented in `TypeScript` that provides IDE-like experiences for static documentation websites. It transforms source code with comments into interactive documentation featuring syntax highlighting, hover documentation, and goto definition functionality.

## Technical Details

This project utilizes both [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) and [LSIF](https://lsif.dev/)/[SCIP](https://github.com/sourcegraph/scip) for source code analysis.

- **Tree-sitter** for syntax highlighting
- **LSIF/SCIP** for embedding LSP info into generated HTML

The workflow:
1. Run LSIF/SCIP generator to create index files for your project
2. Cire processes source code and separates block comments from code
3. Apply Tree-sitter for highlighting and SCIP for LSP information
4. Generate intermediate representation with all highlighting and LSP data
5. Create final static website files

## Installation

### Prerequisites

- **Node.js**: `22.21.0` (see engines in package.json)
- **pnpm**: `>=10.0.0` (recommended package manager)

### Build from Source

```bash
# Clone the repository
git clone <repository-url>
cd cire

# Install dependencies
pnpm install

# Build the project
pnpm build

# Install globally (optional)
pnpm link --global
```

## Usage

### CLI Commands

Cire provides a command-line interface with two main commands:

#### 1. Highlight Command (Currently Available)

Generates HTML documentation with syntax highlighting from a single source file.

```bash
# Basic usage
cire highlight -i <input-file>

# With custom output
cire highlight -i src/example.ts -o docs/example.html

# With specific language (defaults to typescript)
cire highlight -i src/example.ts -l typescript

# Enable verbose logging
cire highlight -i src/example.ts -v
```

**Command Options:**
- `-i, --input <file>`: Input source code file (required)
- `-o, --output <file>`: Output HTML file (default: `input.html`)
- `-l, --language <lang>`: Language for syntax highlighting (default: `typescript`)
- `-v, --verbose`: Enable verbose logging

**Example:**
```bash
# Generate HTML documentation for a TypeScript file
cire highlight -i src/components/Button.tsx -o docs/Button.html -l typescript -v
```

#### 2. Build Command (Planned)

Build static website from source code using `.cire` configuration files.

```bash
# Basic build
cire build -c .cire -o dist/

# Watch mode for development
cire build -c .cire -o dist/ -w

# Verbose build
cire build -c .cire -o dist/ -v
```

**Command Options:**
- `-c, --config <path>`: Path to `.cire` configuration file (default: `.cire`)
- `-o, --output <dir>`: Output directory for generated website
- `-w, --watch`: Watch for changes and rebuild automatically
- `-v, --verbose`: Enable verbose logging

### Configuration

Cire uses JSON-based configuration files (`.cire`) to define project settings:

```json
{
  "name": "My Project Documentation",
  "version": "1.0.0",
  "description": "Interactive documentation for My Project",
  "input": {
    "root": "src",
    "include": ["**/*.ts", "**/*.tsx"],
    "exclude": ["**/*.test.ts", "**/*.spec.ts"],
    "language": "typescript"
  },
  "output": {
    "directory": "docs",
    "baseUrl": "/my-project"
  },
  "lsp": {
    "indexPath": "index.scip",
    "provider": "scip"
  },
  "theme": {
    "name": "github-light",
    "customCss": ["styles/custom.css"]
  }
}
```

### Development

#### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage
```

#### Code Quality

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Fix linting issues
pnpm lint:fix
```

#### Development Mode

```bash
# Watch mode for development
pnpm dev

# Clean build artifacts
pnpm clean
```

## Current Status

### ✅ Implemented Features
- **TypeScript Syntax Highlighting**: Tree-sitter based syntax highlighting
- **Token Processing Pipeline**: Merge and sort token passes for HTML generation
- **CLI Interface**: Command-line tool for single file highlighting
- **HTML Generation**: Static HTML output with embedded styling
- **Testing**: Comprehensive unit tests with high coverage

### 🚧 In Development
- **Multi-file Processing**: Full project documentation generation
- **LSP Integration**: LSIF/SCIP support for hover docs and goto definition
- **Configuration System**: `.cire` file parsing and validation
- **Theme System**: Customizable CSS themes and styling
- **Navigation**: Auto-generated table of contents and cross-references

### 📋 Planned Features
- **Multi-language Support**: JavaScript, Python, Go, Rust, etc.
- **Interactive Elements**: Collapsible sections, code execution snippets
- **Search Functionality**: Full-text search across generated documentation
- **Deployment Integration**: GitHub Pages, Netlify, Vercel deployment tools

## Architecture

The Cire architecture follows a modular pipeline design:

```
Source Code → LSIF/SCIP Index → Token Processing → HTML Generation → Static Website
```

### Core Components

- **Token Processing** (`src/passes/`): Handles token merging, sorting, and highlighting
- **Syntax Highlighting** (`src/highlighter/`): Tree-sitter integration for syntax analysis
- **HTML Generation** (`src/generator/`): Converts processed tokens to HTML output
- **Configuration** (`src/config/`): Manages project configuration and settings
- **CLI Interface** (`src/cli.ts`): Command-line tool for easy usage

### Token Processing Pipeline

1. **Raw Token Generation**: Tree-sitter creates syntax tokens
2. **Token Sorting**: `SortTokenPass` ensures consistent processing order
3. **Token Merging**: `MergeTokenPass` resolves overlapping spans for HTML rendering
4. **HTML Generation**: Converts processed tokens to styled HTML output

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Run the test suite and ensure coverage
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

