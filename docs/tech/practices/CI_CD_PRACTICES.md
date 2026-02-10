# AgentifUI CI/CD 最佳实践

* **文档版本**：v1.0
* **状态**：设计中
* **最后更新**：2026-01-27
* **参考**：agentifui-pro / LobeChat / Dify

---

## 1. 概述

本文档定义 AgentifUI 项目的 CI/CD 架构设计与最佳实践，综合借鉴业界成熟项目经验。

### 设计原则

| 原则 | 说明 |
|------|------|
| **DRY** | 通过复用 Workflow 和 Composite Actions 消除重复 |
| **智能触发** | 基于变更路径只运行受影响的 Jobs |
| **快速反馈** | 并行执行、分片测试、提前失败 |
| **成本优化** | 跳过重复运行、依赖缓存、资源清理 |

### 快速开始

**Step 1：创建目录结构**

```bash
# 在项目根目录执行
mkdir -p .github/workflows
mkdir -p .github/actions/setup-node-pnpm
```

**Step 2：创建核心文件**

```bash
# 主流水线
touch .github/workflows/ci-pipeline.yml

# 可复用工作流
touch .github/workflows/_reusable-quality-web.yml
touch .github/workflows/_reusable-quality-api.yml
touch .github/workflows/_reusable-db-migration.yml

# Composite Action
touch .github/actions/setup-node-pnpm/action.yml
```

**Step 3：复制本文档中的 YAML 代码**

按以下顺序复制：
1. `setup-node-pnpm/action.yml` → 第 8 章节
2. `_reusable-quality-web.yml` → 第 4.1 章节
3. `_reusable-quality-api.yml` → 第 4.2 章节
4. `ci-pipeline.yml` → 第 3.2 + 3.3 章节

**Step 4：根据项目调整路径**

将 `apps/api/`、`apps/web/`、`packages/db/` 替换为实际目录。

**Step 5：配置 GitHub Secrets**

在仓库 Settings → Secrets 中添加：
- `CODECOV_TOKEN`（可选，覆盖率上传）
- `OPENAI_API_KEY`（可选，自动翻译）

**预期结果**：每次 Push/PR 到 main 分支时，CI 流水线自动运行。

---

## 2. 架构设计

### 2.1 两层复用架构

```
┌─────────────────────────────────────────────────────────────┐
│              Active Workflows (触发器层)                     │
├─────────────────────────────────────────────────────────────┤
│  ci-pipeline.yml         → 主质量门控（PR/Push 触发）        │
│  auto-i18n.yml           → 自动翻译（定时/手动）             │
│  release.yml             → 发布流程（Tag 触发）              │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│         Reusable Workflows (可复用工作流层)                  │
├─────────────────────────────────────────────────────────────┤
│  _reusable-quality-api.yml      → API 质量检查              │
│  _reusable-quality-web.yml      → Web 质量检查              │
│  _reusable-db-migration.yml     → 数据库迁移测试            │
└─────────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────────┐
│        Composite Actions (共享步骤层)                        │
├─────────────────────────────────────────────────────────────┤
│  .github/actions/                                           │
│    ├─ setup-node-pnpm/    → pnpm + Node.js + 缓存           │
│    └─ setup-turborepo/    → Turborepo + 远程缓存            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 主 Workflow | `{purpose}.yml` | `ci-pipeline.yml` |
| 可复用 Workflow | `_reusable-{purpose}.yml` | `_reusable-quality-web.yml` |
| Composite Action | `setup-{tool}/action.yml` | `setup-node-pnpm/action.yml` |

---

## 3. 主流水线设计

### 3.1 CI Pipeline 流程

```mermaid
graph TB
    A[Trigger: Push/PR] --> B[Detect Changes]
    B --> C{API Changed?}
    B --> D{Web Changed?}
    B --> E{DB Migration Changed?}
    
    C -->|Yes| F[API Quality]
    D -->|Yes| G[Web Quality]
    E -->|Yes| H[DB Migration Test]
    
    F --> I[Build API]
    G --> J[Build Web]
    
    I --> K[Integration Tests]
    J --> K
    
    K --> L[E2E Tests]
    L --> M[Pipeline Status]
```

### 3.2 智能变更检测

使用 `dorny/paths-filter` 实现路径级别的变更检测：

```yaml
# .github/workflows/ci-pipeline.yml
jobs:
  detect-changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
      db: ${{ steps.filter.outputs.db }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
              - 'packages/db/**'
              - 'packages/shared/**'
            web:
              - 'apps/web/**'
              - 'packages/ui/**'
              - 'packages/shared/**'
            db:
              - 'packages/db/migrations/**'
              - 'packages/db/schema/**'
```

### 3.3 重复运行跳过

使用 `skip-duplicate-actions` 避免重复执行：

```yaml
jobs:
  check-duplicate:
    runs-on: ubuntu-latest
    outputs:
      should_skip: ${{ steps.skip_check.outputs.should_skip }}
    steps:
      - id: skip_check
        uses: fkirc/skip-duplicate-actions@v5
        with:
          concurrent_skipping: "same_content_newer"
          skip_after_successful_duplicate: "true"
          do_not_skip: '["workflow_dispatch", "schedule"]'
```

---

## 4. 质量门控

### 4.1 前端质量检查 (`_reusable-quality-web.yml`)

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      # 双层 Lint（Oxlint + ESLint）
      - name: Oxlint (快速预检)
        run: pnpm exec oxlint

      - name: ESLint (深度检查)
        run: pnpm run lint

      - name: Prettier 格式检查
        run: pnpm run format:check

      - name: TypeScript 类型检查
        run: pnpm run typecheck

      # Dead Code 检测
      - name: Knip 未使用代码检测
        run: pnpm exec knip
```

### 4.2 后端质量检查 (`_reusable-quality-api.yml`)

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      # Lint
      - name: Oxlint
        run: pnpm --filter @agentifui/api exec oxlint

      - name: ESLint
        run: pnpm --filter @agentifui/api run lint

      - name: TypeScript
        run: pnpm --filter @agentifui/api run typecheck

      # 单元测试
      - name: Jest Tests
        run: pnpm --filter @agentifui/api run test:coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v5
        with:
          flags: api
```

### 4.3 SuperLinter（基础设施检查）

```yaml
jobs:
  superlinter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: super-linter/super-linter/slim@v8
        env:
          VALIDATE_BASH: true
          VALIDATE_DOCKERFILE_HADOLINT: true
          VALIDATE_GITHUB_ACTIONS: true
          VALIDATE_YAML: true
          VALIDATE_EDITORCONFIG: true
```

---

## 5. 测试策略

### 5.1 测试分片（大型测试套件）

对于大型测试套件，使用分片并行执行：

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: pnpm run test --shard=${{ matrix.shard }}/4

  merge-coverage:
    needs: test
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: coverage-shard-*
          merge-multiple: true
      - run: pnpm run coverage:merge
```

### 5.2 数据库迁移测试

```yaml
jobs:
  db-migration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      # 验证离线迁移脚本可生成
      - name: Generate SQL
        run: pnpm --filter @agentifui/db run migrate:generate

      # 执行迁移
      - name: Run Migrations
        run: pnpm --filter @agentifui/db run migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      # 验证 Schema 一致性
      - name: Validate Schema
        run: pnpm --filter @agentifui/db run check
```

### 5.3 E2E 测试

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    services:
      postgres:
        image: postgres:18
        # ... 配置同上

    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium

      - name: Run Migrations
        run: pnpm --filter @agentifui/db run migrate

      - name: Build Application
        run: pnpm run build

      - name: Run E2E Tests
        run: pnpm run e2e

      - name: Upload Artifacts (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-artifacts
          path: |
            e2e/reports
            e2e/screenshots
```

---

## 6. 性能监控

### 6.1 Lighthouse 性能检查

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse Performance

on:
  schedule:
    - cron: '0 0 * * *'  # 每日运行
  workflow_dispatch:

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      - name: Build
        run: pnpm run build

      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true
```

### 6.2 Bundle 体积分析

```yaml
# .github/workflows/bundle-analyzer.yml
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      - name: Build with Analyzer
        run: ANALYZE=true pnpm --filter @agentifui/web run build

      - name: Upload Bundle Report
        uses: actions/upload-artifact@v4
        with:
          name: bundle-report
          path: apps/web/.next/analyze/
```

---

## 7. 自动化工作流

### 7.1 自动 i18n 翻译

```yaml
# .github/workflows/auto-i18n.yml
name: Auto i18n Translation

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      - name: Run i18n Translation
        run: pnpm run i18n:translate
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          title: '🌐 chore: update i18n translations'
          branch: chore/auto-i18n
          labels: i18n, automated
```

### 7.2 自动修复

```yaml
# .github/workflows/autofix.yml
name: Autofix

on:
  push:
    branches: [main]

jobs:
  autofix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-pnpm

      - name: Oxlint Autofix
        run: pnpm exec oxlint --fix

      - name: ESLint Autofix
        run: pnpm run lint:fix

      - name: Prettier Format
        run: pnpm run format

      - name: Commit Changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: '🤖 chore: autofix lint and format'
```

---

## 8. Composite Actions

### 8.1 setup-node-pnpm

```yaml
# .github/actions/setup-node-pnpm/action.yml
name: Setup Node.js and pnpm
description: Setup Node.js with pnpm and dependency caching

inputs:
  node-version:
    description: Node.js version
    default: '22'
  working-directory:
    description: Working directory
    default: '.'

runs:
  using: composite
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm
        cache-dependency-path: ${{ inputs.working-directory }}/pnpm-lock.yaml

    - name: Install dependencies
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: pnpm install --frozen-lockfile
```

---

## 9. 工作流文件清单

| 文件 | 触发条件 | 功能 |
|------|---------|------|
| `ci-pipeline.yml` | Push/PR to main | 主质量门控 |
| `_reusable-quality-api.yml` | workflow_call | API 质量检查 |
| `_reusable-quality-web.yml` | workflow_call | Web 质量检查 |
| `_reusable-db-migration.yml` | workflow_call | 数据库迁移测试 |
| `e2e.yml` | Push/PR to main | 端到端测试 |
| `lighthouse.yml` | 每日定时 | 性能监控 |
| `bundle-analyzer.yml` | 手动触发 | 打包体积分析 |
| `auto-i18n.yml` | 每日定时 | 自动翻译 |
| `autofix.yml` | Push to main | 自动修复 |
| `release.yml` | Tag 创建 | 发布流程 |

---

## 10. GitHub Status Checks 配置

建议在仓库设置中配置以下必需的 Status Checks：

| Check 名称 | 必需 | 说明 |
|-----------|------|------|
| `CI Pipeline / API Quality` | ✅ | API 代码质量 |
| `CI Pipeline / Web Quality` | ✅ | Web 代码质量 |
| `CI Pipeline / DB Migration Test` | ✅ | 迁移安全性 |
| `CI Pipeline / E2E Tests` | ✅ | 端到端测试 |
| `CI Pipeline / Pipeline Status` | ✅ | 总体状态 |

---

## 附录 A: 依赖版本

| 工具 | 版本 | 用途 |
|------|------|------|
| `actions/checkout` | v4 | 代码检出 |
| `actions/setup-node` | v4 | Node.js 环境 |
| `pnpm/action-setup` | v4 | pnpm 安装 |
| `dorny/paths-filter` | v3 | 路径变更检测 |
| `fkirc/skip-duplicate-actions` | v5 | 重复运行跳过 |
| `super-linter/super-linter` | v8 | 多语言 Lint |
| `codecov/codecov-action` | v5 | 覆盖率上传 |
| `peter-evans/create-pull-request` | v7 | 自动创建 PR |

---

## 附录 B: 参考来源

| 项目 | 借鉴特性 |
|------|---------|
| **agentifui-pro** | 两层复用架构、智能变更检测、命名规范 |
| **LobeChat** | 测试分片、重复检测、Lighthouse、OpenAI i18n |
| **Dify** | SuperLinter、Knip 死代码检测、多数据库迁移测试 |

---

*文档结束*
