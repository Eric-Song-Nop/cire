# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Cire 是一个用 TypeScript 实现的静态网站生成器，专门为静态文档网站提供 IDE 式的交互体验。它能够将源代码转换为具有语法高亮、悬停文档和 Markdown 渲染功能的交互式文档。

### 核心特性
- **双分析器架构**: 支持 Tree-sitter 语法高亮和 SCIP 代码智能分析
- **交互式 hover**: 丰富的 tooltip 信息，支持 Markdown 格式渲染
- **模块化样式**: 外部 CSS 文件，易于自定义和主题切换
- **静态生成**: 纯前端解决方案，无需后端服务器
- **多语言支持**: 基于 Tree-sitter，可扩展支持多种编程语言

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
源代码 → 分析器 (Tree-sitter/SCIP) → Token 处理管道 → HTML 生成 → 静态网站
```

### 数据流设计

1. **源文件输入**: 读取 TypeScript 源代码
2. **分析器处理**:
   - **Tree-sitter 路线**: 生成语法树和提取语法高亮 tokens
   - **SCIP 路线**: 解析 SCIP 索引，提取 hover 文档和符号信息
3. **Token 处理管道**: 排序 → 合并 → 过滤
4. **HTML 生成**: 应用 CSS 样式，生成带交互功能的 HTML 文档
5. **样式应用**: 引用外部 CSS 文件，支持 hover tooltips 和 Markdown 渲染

### 主要模块

1. **分析器模块** (`src/analyzer/`)
   - `TSHighlighter`: 基于 Tree-sitter 的 TypeScript 语法分析器
   - `SCIPAnalyzer`: 基于 SCIP 协议的代码智能分析器，支持 hover 文档
   - 实现 `Analyzer` 接口，支持扩展其他语言

2. **Token 处理管道** (`src/passes/`)
   - `TokenInfoPass`: 基础 Token 信息提取
   - `SortTokenPass`: Token 按 start position 排序
   - `MergeTokenPass`: 处理重叠 Token 的合并逻辑

3. **生成器模块** (`src/generator/`)
   - `HTMLGenerator`: 将 Token 转换为带样式的 HTML
   - 支持交互式 hover tooltips 和 Markdown 渲染
   - 使用外部 CSS 文件进行样式分离

4. **CLI 接口** (`src/cli.ts`)
   - 使用 Commander.js 实现
   - 支持 `highlight` 命令，`build` 命令计划中


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

### 双分析器架构
Cire 支持两种分析器，可以单独或组合使用：
1. **TSHighlighter**: 基于 Tree-sitter 的语法分析
   - 提供语法高亮 tokens
   - 支持多种语言的语法解析
   - 适合基本的代码着色需求

2. **SCIPAnalyzer**: 基于 SCIP 协议的代码智能分析
   - 提供丰富的 hover 文档信息
   - 支持符号定义和引用跳转
   - 需要预先生成的 SCIP 索引文件

### CSS 样式系统
- **模块化设计**: 样式与 HTML 分离，存储在 `templates/default.css`
- **双类名支持**: 同时支持 `token-` 前缀和无前缀的 CSS 类名
- **完整语法高亮**: 覆盖 TypeScript 的所有语法元素
- **交互式样式**: 支持 hover tooltips 的视觉反馈
- **Markdown 渲染**: 在 tooltips 中支持富文本显示

### Token 处理管道
Token 处理遵循严格的顺序：
1. **排序**: 按 `range.start` 升序排列
2. **合并**: 处理重叠的 Token 范围，包括语法高亮和 hover 信息
3. **过滤**: 移除无效或不需要的 Token

### Hover 功能与 Markdown 渲染
- **数据属性**: 使用 `data-hover-content` 和 `data-hover-documentation` 存储信息
- **客户端渲染**: JavaScript 在浏览器中解析 Markdown 并显示 tooltips
- **支持的 Markdown**: 代码块、内联代码、粗体、斜体、列表、标题等
- **智能定位**: 自动调整 tooltip 位置以避免超出视窗

### SCIP 集成
- **协议解析**: 使用 Protocol Buffers 解析 SCIP 索引文件
- **路径处理**: 支持文件路径标准化和 URI 解码
- **范围转换**: 将 SCIP 数组范围转换为项目 TextSpan 格式
- **符号匹配**: 支持文档路径的多种匹配策略

### 错误处理
- 使用统一的错误类型体系
- 详细的错误消息和上下文信息
- 支持优雅的错误恢复

### 模块化设计
- 清晰的模块边界和接口定义
- 依赖注入模式支持测试和扩展
- 每个模块有单一职责

## 使用示例

### 基本语法高亮
```bash
# 生成基本的语法高亮 HTML
pnpm start highlight -i src/example.ts -o docs/example.html

# 复制 CSS 文件到输出目录
cp templates/default.css docs/
```

### SCIP 增强功能
```bash
# 1. 首先生成 SCIP 索引（使用 scip-typescript）
npx @sourcegraph/scip-typescript index

# 2. 使用 SCIP 分析器生成带 hover 文档的 HTML
pnpm start highlight -i src/example.ts -o docs/example.html

# 3. 确保 CSS 文件在同一目录
cp templates/default.css docs/
```

### 批量处理
```bash
# 处理多个文件
for file in src/*.ts; do
  output="docs/$(basename "$file" .ts).html"
  pnpm start highlight -i "$file" -o "$output"
done

# 复制 CSS 一次
cp templates/default.css docs/
```

## 部署说明

### 文件结构
生成的静态网站需要以下文件结构：
```
docs/
├── example.html          # 生成的 HTML 文件
└── default.css           # 样式文件
```

### Web 服务器部署
```bash
# 使用任何静态文件服务器
python -m http.server 8000
# 或
npx serve docs
# 或
pnpm add -D live-server && npx live-server docs
```

### GitHub Pages
1. 将生成的 HTML 和 CSS 文件推送到 `gh-pages` 分支
2. 在仓库设置中启用 GitHub Pages
3. 选择 `gh-pages` 分支作为源

### 注意事项
- **CSS 文件依赖**: HTML 文件需要引用同目录下的 `default.css`
- **相对路径**: 使用相对路径引用 CSS，便于部署到任何目录
- **浏览器兼容性**: 支持现代浏览器，使用 ES6+ JavaScript
- **SCIP 索引**: 如需 hover 功能，需要预先生成 SCIP 索引文件

## Tool

Use `scip` cli tool to inspect and test `index.scip` file generation and content
