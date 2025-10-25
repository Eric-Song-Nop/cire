# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cire is a static website generator implemented in TypeScript that provides IDE-like experiences for static websites. It transforms source code with comments into interactive documentation websites featuring syntax highlighting, hover documentation, and goto definition functionality.

## Core Architecture

### Technology Stack
- **Language**: TypeScript
- **Package Manager**: pnpm, always use `ni` for the right package manager
- **Syntax Highlighting**: Tree-sitter parser
- **LSP Integration**: LSIF/SCIP for embedding language server information
- **Output**: Pure HTML/CSS + minimal JavaScript for interactions

### Workflow Pipeline
```
Source Code → LSIF/SCIP Generation → Cire Generator → Static Website
```

1. **Input Processing**: Tree-sitter separates block comments from code
2. **Two-pass Generation**:
   - Pass 1: Tree-sitter for syntax highlighting
   - Pass 2: SCIP for LSP information extraction
3. **IR Generation**: Creates intermediate representation with highlighting and LSP data
4. **Website Generation**: Converts IR to final HTML files

### Key Components (Planned)
- **Comment Parser**: Extracts block comments and converts to Markdown
- **Code Block Processor**: Applies syntax highlighting using Tree-sitter
- **LSP Integration**: Maps LSIF/SCIP data to static interactions
- **HTML Generator**: Creates templated website structure
- **Configuration System**: JSON-based project configuration (.cire files)

## Development Commands

### BMAD Core Framework
This project uses BMAD™ Core for project management. Use the following slash commands:

- `/BMad:dev` - Activate development agent (James) for implementation
- `/BMad:facilitate-brainstorming-session` - Run structured brainstorming sessions
- `/BMad:document-project` - Generate comprehensive project documentation

### Development Agent Commands
When using the `/BMad:dev` agent, these commands are available (use `*` prefix):

- `*help` - Show all available commands
- `*develop-story` - Implement development stories sequentially
- `*explain` - Get detailed explanations of implemented work
- `*review-qa` - Run quality assurance checks
- `*run-tests` - Execute linting and tests
- `*exit` - Exit development agent mode

## Project Structure

### Current State
- **Planning Phase**: MVP functionality defined, ready for development
- **Core Documentation**:
  - `README.md` - Technical overview and architecture
  - `docs/brainstorming-session-results.md` - Detailed MVP planning
- **BMAD Framework**: Located in `.bmad-core/` with development workflows
- **Agent Definitions**: Development agents and tasks in `.claude/commands/BMad/`

### Planned Structure
Based on MVP planning, the project will include:
- `src/` - TypeScript source code
- `src/parsers/` - Comment and code parsing logic
- `src/generators/` - HTML and CSS generation
- `src/lsp/` - LSIF/SCIP integration
- `src/config/` - Configuration file handling
- `templates/` - HTML templates and CSS frameworks
- `examples/` - Sample projects for testing

## Development Standards

### Always Load Files
The development agent automatically loads these files during activation:
- `docs/architecture/coding-standards.md` (when created)
- `docs/architecture/tech-stack.md` (when created)
- `docs/architecture/source-tree.md` (when created)

### MVP Development Phases
1. **Base Parser**: JSON configuration, comment extraction, source file scanning
2. **HTML Generator**: Templates, CSS framework, navigation
3. **Tree-sitter Integration**: TypeScript support, syntax highlighting
4. **LSP Integration**: LSIF/SCIP parsing, hover documentation
5. **Goto Definition**: Definition mapping, cross-page linking
6. **Integration Testing**: End-to-end validation, error handling

## Key Technical Decisions

### MVP Scope
- **Language Support**: TypeScript only (initially)
- **Features**: Hover docs and goto definition required
- **Output**: Pure HTML + CSS + minimal JS
- **Configuration**: JSON-based (.cire files)
- **Navigation**: Simple file list structure

### Architecture Principles
- **Static Generation**: All IDE features implemented as static interactions
- **Comment-Driven**: Content derived from block comments in source code
- **Zero Learning Curve**: Uses existing development workflows
- **Framework Agnostic**: Pure HTML/CSS output for maximum compatibility

## Notes for Development

- Project currently has no package.json, tsconfig.json, or source code - this is initial setup
- Focus on implementing MVP features as defined in brainstorming documentation
- Use BMAD framework development agent for structured implementation
- All LSP information should be pre-generated via LSIF/SCIP tools
- Target users are developers wanting to create documentation from existing codebases
