# Cire

**Cire** is a TypeScript static website generator that creates IDE-like interactive documentation from your source code. It transforms code with comments into beautiful documentation with syntax highlighting, hover tooltips, and intelligent navigation.

## ✨ Features

- 🌈 **Interactive Experience**: Rich tooltips and more LSP features in the future
- 📝 **Comment-Driven Docs**: Auto-converts block comments to Doc
- 🎨 **Richest Themes**: Syntax highlighting driven by Tree-sitter

## 🚀 Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/Eric-Song-Nop/cire.git
cd cire
pnpm install
pnpm build

# Install globally (optional)
pnpm link --global
```

### Basic Usage

```bash
# Single file processing
cire -i src/example.ts -o docs/example.html

# Project mode with configuration
cire -c .cire.json5

# Enhanced with SCIP hover documentation
npx @sourcegraph/scip-typescript index
cire -i src/example.ts -s index.scip -o docs/example.html
```

### Configuration

Create `.cire.json5` for your project, checkout the example configuration file in the repository.

## 🛠️ Development

```bash
# Development mode
pnpm dev

# Run tests
pnpm test

# Code quality
pnpm lint
pnpm format

# Build project
pnpm build
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
