# Testing with Vitest

Cire 项目已成功迁移到 Vitest，提供了现代化的测试体验。

## 快速开始

### 运行测试

```bash
# 监听模式运行测试（推荐开发时使用）
pnpm test

# 单次运行所有测试
pnpm test:run

# 启动测试 UI 界面
pnpm test:ui

# 生成覆盖率报告
pnpm test:coverage
```

### 测试配置

项目使用根目录的 `vitest.config.ts` 配置文件：

- **环境**: Node.js 环境（适合测试 CLI 工具和文件系统操作）
- **全局**: 启用全局测试函数（`describe`, `it`, `expect` 等）
- **覆盖率**: 使用 v8 提供者，支持多种输出格式
- **类型别名**: `@` 映射到 `./src` 目录

## 测试结构

```
src/
├── highlighter/
│   ├── highlighter.ts           # 主实现
│   └── __tests__/
│       └── highlighter.test.ts  # 测试文件
└── ...                          # 其他模块
vitest.config.ts                 # 全局测试配置
```

## 编写测试

### 基本测试结构

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MyClass } from "../my-class";

describe("MyClass", () => {
  let instance: MyClass;

  beforeEach(() => {
    // 每个测试前运行
    instance = new MyClass();
  });

  it("应该正确初始化", () => {
    expect(instance).toBeDefined();
  });

  afterEach(() => {
    // 每个测试后运行（清理资源）
  });
});
```

### 测试异步代码

```typescript
it("应该处理异步操作", async () => {
  const result = await instance.asyncMethod();
  expect(result).toBe("expected");
});
```

### 测试文件系统操作

```typescript
import fs from "node:fs";
import path from "node:path";

it("应该正确处理文件", () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "test-"));

  try {
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");

    const result = instance.processFile(testFile);
    expect(result).toBeDefined();
  } finally {
    // 清理临时文件
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

## 测试覆盖率

运行覆盖率测试：

```bash
pnpm test:coverage
```

覆盖率报告将生成在 `coverage/` 目录中，包含：
- `index.html` - 可视化的 HTML 报告
- `clover.xml` - Clover XML 格式
- `coverage-final.json` - JSON 格式的详细数据

## 调试测试

### 使用 VS Code 调试

1. 安装 [Vitest](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer) 扩展
2. 在测试文件旁边点击调试按钮
3. 或使用 VS Code 的内置调试器配置

### 使用命令行调试

```bash
# 运行特定测试文件
pnpm test src/highlighter/__tests__/highlighter.test.ts

# 运行匹配名称的测试
pnpm test -t "应该正确初始化高亮器"

# 监听模式 + 调试模式
pnpm test --inspect-brk
```

## 最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 采用 "应该 + 期望行为" 的格式
- 使用中文或英文保持一致性

### 2. 测试组织
- 使用 `describe` 组织相关测试
- 使用 `beforeEach`/`afterEach` 管理测试环境
- 保持测试的独立性和可重复性

### 3. 断言
- 使用具体的期望值
- 测试边界条件和错误情况
- 验证类型和结构

### 4. 模拟和存根
- 使用 `vi.fn()` 创建模拟函数
- 使用 `vi.mock()` 模拟模块
- 在 `afterEach` 中清理模拟状态

## 迁移说明

项目已从 Jest 迁移到 Vitest：

### 主要变化
- ✅ 更快的启动和执行速度
- ✅ ESM 原生支持
- ✅ 更好的 TypeScript 支持
- ✅ 内置源码映射支持
- ✅ 现代化的 UI 界面

### 兼容性
- 大多数 Jest API 保持兼容
- 测试语法基本相同
- 断言 API 一致

### 已移除
- Jest 配置文件
- Jest 相关依赖
- ts-jest 预处理器

## 故障排除

### 常见问题

1. **导入错误**: 确保使用正确的相对路径
2. **类型错误**: 检查 TypeScript 配置和导入
3. **超时错误**: 使用 `testTimeout` 配置增加超时时间

### 获取帮助

- 查看 [Vitest 官方文档](https://vitest.dev/)
- 检查现有测试文件作为参考
- 使用 `pnpm test --reporter=verbose` 获取详细输出