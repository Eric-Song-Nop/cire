# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Cire 是一个用 TypeScript 实现的静态网站生成器，专门为静态文档网站提供 IDE 式的交互体验。它能够将源代码转换为具有语法高亮、悬停文档和 Markdown 渲染功能的交互式文档。

### 核心特性
- **双分析器架构**: 支持 Tree-sitter 语法高亮和 SCIP 代码智能分析
- **交互式 hover**: 丰富的 tooltip 信息，支持 Markdown 格式渲染
- **模块化样式**: 外部 CSS 文件，易于自定义和主题切换
- **静态生成**: 纯前端解决方案，无需后端服务器
- **多语言支持**: 基于 Tree-sitter，可扩展支持多种编程语言（当前支持 TypeScript）
- **工作流管理**: 统一的 WorkflowManager 协调各个处理管道
- **注释驱动**: 自动提取和转换块注释为 Markdown 内容

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

1. **工作流管理** (`src/workflow/`)
   - `WorkflowManager`: 统一协调各个分析器和生成器
   - 支持灵活的插件化架构
   - 处理配置验证和错误管理

2. **分析器模块** (`src/analyzer/`)
   - `TSHighlighter`: 基于 Tree-sitter 的 TypeScript 语法分析器
   - `SCIPAnalyzer`: 基于 SCIP 协议的代码智能分析器，支持 hover 文档
   - `CommentAnalyzer`: 注释分析器，支持 JSDoc 和块注释解析
   - 实现 `Analyzer` 接口，支持扩展其他语言

3. **Token 处理管道** (`src/passes/`)
   - `TokenInfoPass`: 基础 Token 信息提取
   - `SortTokenPass`: Token 按 start position 排序
   - `MergeTokenPass`: 处理重叠 Token 的合并逻辑
   - `CommentMergePass`: 注释优先级处理和合并

4. **生成器模块** (`src/generator/`)
   - `HTMLGenerator`: 将 Token 转换为带样式的 HTML
   - 支持交互式 hover tooltips 和 Markdown 渲染
   - 使用外部 CSS 文件进行样式分离
   - 支持响应式设计和现代 CSS 特性

5. **配置管理** (`src/config/`)
   - `ConfigLoader`: 加载和验证 `.cire` 配置文件
   - `ConfigValidator`: 配置文件验证和错误提示
   - 支持默认配置和用户自定义配置

6. **CLI 接口** (`src/cli.ts`)
   - 使用 Commander.js 实现
   - 支持 `highlight` 命令（已完全实现）
   - `build` 命令基础框架已搭建（核心功能待实现）

7. **类型系统** (`src/types/`)
   - 完整的 TypeScript 类型定义
   - 自定义错误类型体系（`CireError`, `ConfigError` 等）
   - 严格的类型检查和验证


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
   - 支持多种语言的语法解析（当前实现 TypeScript）
   - 适合基本的代码着色需求
   - 使用完整的 Tree-sitter 查询文件定义语法规则

2. **SCIPAnalyzer**: 基于 SCIP 协议的代码智能分析
   - 提供丰富的 hover 文档信息
   - 支持符号定义和引用跳转
   - 需要预先生成的 SCIP 索引文件
   - 支持全局符号查找和文档路径匹配

3. **CommentAnalyzer**: 注释分析器（新增）
   - 自动提取和转换块注释为 Markdown 内容
   - 支持 JSDoc 标签解析和渲染
   - 注释优先级处理和合并逻辑
   - 注释驱动的内容生成

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
3. **注释合并**: 特殊处理注释 tokens，确保注释优先级
4. **过滤**: 移除无效或不需要的 Token

### 工作流管理
WorkflowManager 提供统一的处理流程：
1. **配置加载**: 验证和加载 `.cire` 配置文件
2. **文件扫描**: 根据配置扫描源代码文件
3. **分析器执行**: 按配置启用相应的分析器
4. **Token 管道**: 按顺序执行各个处理阶段
5. **HTML 生成**: 将最终 tokens 转换为 HTML
6. **模板包装**: 应用 HTML 模板和样式引用

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

### 配置系统
- **JSON 配置**: 使用 `.cire` 文件进行项目配置
- **配置验证**: 完整的配置验证和错误提示
- **默认值**: 提供合理的默认配置
- **灵活性**: 支持输入输出路径、语言、主题等配置

### 测试框架
- **Vitest**: 使用现代化的测试框架
- **测试覆盖**: 25个测试用例，覆盖核心功能
- **类型安全**: 完整的 TypeScript 类型检查
- **错误处理**: 完善的错误测试用例

### 模块化设计
- 清晰的模块边界和接口定义
- 依赖注入模式支持测试和扩展
- 每个模块有单一职责
- 插件化架构支持功能扩展

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

### 配置文件使用
```bash
# 使用配置文件（当前 .cire.example 可作为参考）
# 创建 .cire 配置文件后可以批量处理项目
cire build -c .cire -o dist/
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

## 当前实现状态

### 已完成功能 ✅
- **完整的 CLI 接口**: `highlight` 命令完全实现
- **双分析器架构**: TSHighlighter、SCIPAnalyzer、CommentAnalyzer
- **Token 处理管道**: 排序、合并、注释合并、过滤
- **HTML 生成器**: 语法高亮、hover 功能、Markdown 渲染
- **样式系统**: 完整的 CSS 主题，响应式设计
- **配置系统**: `.cire` 文件加载和验证
- **工作流管理**: WorkflowManager 统一协调
- **测试覆盖**: 25个测试用例，使用 Vitest

### 进行中功能 🔄
- **build 命令**: 基础框架已搭建，核心功能待实现
- **SCIP 集成优化**: 性能优化和错误处理改进
- **JSDoc 特性**: 更丰富的 JSDoc 标签支持

### 计划中功能 ❌
- **批量处理**: 基于 `.cire` 配置文件的批量生成
- **文件监控**: watch 模式实时更新
- **多语言支持**: 扩展 Tree-sitter 支持更多语言
- **主题系统**: 自定义主题支持
- **导航系统**: 多页面链接和文件列表

### 技术债务
- **性能优化**: 大文件处理性能改进
- **错误处理**: 跨平台路径处理优化
- **文档完善**: 用户指南和示例项目

## Tool

Use `scip` cli tool to inspect and test `index.scip` file generation and content
