# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Cire 是一个用 TypeScript 实现的静态网站生成器，专门为静态文档网站提供 IDE 式的交互体验。它能够将带有注释的源代码转换为具有语法分析、悬停文档和跳转定义功能的交互式文档。

## 核心开发命令

### 开发工作流
```bash
pnpm dev          # TypeScript 编译监视模式
pnpm build        # 构建项目到 dist/
pnpm start        # 运行构建后的 CLI (node dist/cli.js)
pnpm clean        # 删除构建产物
```

### 代码质量
```bash
pnpm lint         # Biome 代码检查
pnpm format       # Biome 代码格式化
pnpm lint:fix     # 自动修复可修复的问题
```

### 测试
```bash
pnpm test         # 运行所有测试
pnpm test:ui      # 启动 Vitest UI 界面
pnpm test:run     # 一次性运行测试（无监视）
pnpm test:coverage # 生成覆盖率报告
```

### CLI 使用
```bash
# 语法高亮（已实现）
cire highlight -i src/example.ts [-o docs/example.html] [-l typescript] [-v]

# 构建网站（计划中）
cire build [-c .cire] [-o dist/] [-w] [-v]
```

## 架构概述

### 核心流程
```
源代码 → Tree-sitter 解析 → Token 处理管道 → HTML 生成 → 静态网站
```

### 主要模块

1. **分析器模块** (`src/analyzer/`)
   - `TSHighlighter`: 基于 Tree-sitter 的 TypeScript 语法分析器
   - 实现 `Analyzer` 接口，支持扩展其他语言

2. **Token 处理管道** (`src/passes/`)
   - `TokenInfoPass`: 基础 Token 信息提取
   - `SortTokenPass`: Token 按 start position 排序
   - `MergeTokenPass`: 处理重叠 Token 的合并逻辑

3. **生成器模块** (`src/generator/`)
   - `HTMLGenerator`: 将 Token 转换为带样式的 HTML
   - 包含完整的 HTML 文档模板

4. **CLI 接口** (`src/cli.ts`)
   - 使用 Commander.js 实现
   - 支持 `highlight` 命令，`build` 命令计划中

### 数据流设计

1. **源文件输入**: 读取 TypeScript 源代码
2. **Tree-sitter 解析**: 生成语法树和提取 tokens
3. **Token 处理管道**: 排序 → 合并 → 过滤
4. **HTML 生成**: 应用 CSS 样式并生成完整 HTML 文档

## 开发约定

### 代码风格
- 使用 4 空格缩进
- 双引号字符串
- TypeScript 严格模式
- 详细的错误处理和日志输出

### 类型系统
- 所有类型定义集中在 `src/types/index.ts`
- 使用严格的 TypeScript 类型
- 自定义错误类型体系 (`CireError`, `ConfigError` 等)

### 测试约定
- 测试文件使用 `.test.ts` 扩展名
- 使用 Vitest 作为测试框架
- 测试文件与源文件同目录或 `__tests__` 目录

### 配置文件
- 项目使用 `.cire` JSON 配置文件
- 参考配置示例: `.cire.example`
- 支持输入输出路径、语言、主题等配置

## 重要技术细节

### Token 处理管道
Token 处理遵循严格的顺序：
1. **排序**: 按 `range.start` 升序排列
2. **合并**: 处理重叠的 Token 范围
3. **过滤**: 移除无效或不需要的 Token

### 错误处理
- 使用统一的错误类型体系
- 详细的错误消息和上下文信息
- 支持优雅的错误恢复

### 模块化设计
- 清晰的模块边界和接口定义
- 依赖注入模式支持测试和扩展
- 每个模块有单一职责

## Tool

Use `scip` cli tool to inspect and test `index.scip` file generation and content
