# AgentifUI 新人入职指南

* **文档版本**：v1.0
* **最后更新**：2026-01-27
* **适用对象**：新加入 AgentifUI 项目的开发者

---

## 目录

1. [欢迎与概览](#欢迎与概览)
2. [文档导航地图](#文档导航地图)
3. [Day 1-5 任务清单](#day-1-5-任务清单)
4. [开发环境配置](#开发环境配置)
5. [第一个任务](#第一个任务)
6. [常见问题 FAQ](#常见问题-faq)

---

## 欢迎与概览

欢迎加入 AgentifUI 项目！AgentifUI 是**面向企业的 AI 应用与智能体统一管理平台**。

### 项目特点

- **TypeScript 全栈**：前后端统一语言
- **AI 协作开发**：Human + AI Agent 协作模式
- **切片驱动**：按端到端可验收路径开发
- **规范优先**：所有决策沉淀为可版本化的规范文档

### 团队协作模式

- **异步优先**：使用 GitHub Issues / 飞书文档进行异步协作
- **周末同步**：每周六/日 1-2 小时同步会议
- **SLA 响应**：P0 当天、P1 48h、P2 周末会

---

## 文档导航地图

> 按阅读顺序排列，建议 Day 1-2 完成必读文档。

### 必读文档（Day 1-2）

| 序号 | 文档 | 说明 | 预计阅读时间 |
|------|------|------|-------------|
| 1 | [README.md](../../README.md) | 项目概览与文档索引 | 10 min |
| 2 | [PRD.md](../../prd/PRD.md) | 核心业务需求（重点看"Scope"和"术语表"） | 30 min |
| 3 | [TECHNOLOGY_STACK.md](../TECHNOLOGY_STACK.md) | 技术选型决策 | 20 min |
| 4 | [DEVELOPMENT_WORKFLOW.md](../../DEVELOPMENT_WORKFLOW.md) | 开发流程与 AI 协作规范 | 40 min |
| 5 | [SYSTEM_BOUNDARY.md](../architecture/SYSTEM_BOUNDARY.md) | 系统分层与职责 | 15 min |

### 当前开发阶段文档（Day 2-3）

| 文档 | 说明 |
|------|------|
| [ROADMAP_V1_0.md](../../roadmap/ROADMAP_V1_0.md) | 当前版本路线图 |
| [PHASE1_BACKLOG.md](../../roadmap/PHASE1_BACKLOG.md) | Phase 1 切片定义 |
| [PHASE1_ACCEPTANCE.md](../../roadmap/PHASE1_ACCEPTANCE.md) | Phase 1 验收标准 |

### 技术规范（按需查阅）

| 文档 | 说明 |
|------|------|
| [DOMAIN_MODEL_P1.md](../data-model/DOMAIN_MODEL_P1.md) | 核心领域模型 |
| [GATEWAY_CONTRACT_P1.md](../api-contracts/GATEWAY_CONTRACT_P1.md) | API 契约规范 |
| [Gateway 项目文档](../../gateway/README.md) | Gateway 独立项目（架构、仓库结构、MVP） |
| [REPO_STRUCTURE.md](./REPO_STRUCTURE.md) | 代码目录规范 |
| [NFR_BASELINE.md](./NFR_BASELINE.md) | 非功能约束 |
| [ENGINEERING_GUIDELINES.md](./ENGINEERING_GUIDELINES.md) | 工程规范 |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | 测试策略 |

### 设计规范（前端必读）

| 文档 | 说明 |
|------|------|
| [DESIGN_SYSTEM_P1.md](../../design/DESIGN_SYSTEM_P1.md) | 设计系统规范 |
| [DESIGN_WORKFLOW.md](../../design/DESIGN_WORKFLOW.md) | 设计工作流程 |

---

## Day 1-5 任务清单

### Day 1：阅读与理解

- [ ] 阅读 [README.md](../../README.md) 了解项目全貌
- [ ] 阅读 [PRD.md](../../prd/PRD.md) 前 5 章，理解业务边界
- [ ] 阅读 [TECHNOLOGY_STACK.md](../TECHNOLOGY_STACK.md)，确认技术栈熟悉程度
- [ ] 加入团队沟通频道（Slack / 飞书）

### Day 2：环境配置

- [ ] 完成[开发环境配置](#开发环境配置)
- [ ] 克隆代码仓库，成功运行项目
- [ ] 阅读 [DEVELOPMENT_WORKFLOW.md](../../DEVELOPMENT_WORKFLOW.md)
- [ ] 了解当前 Slice 进度（查看 `.agent/context/progress.md`）

### Day 3：深入理解

- [ ] 阅读当前 Slice 的 FRD（如有）
- [ ] 阅读 [REPO_STRUCTURE.md](./REPO_STRUCTURE.md)，熟悉代码结构
- [ ] 阅读 [ENGINEERING_GUIDELINES.md](./ENGINEERING_GUIDELINES.md)
- [ ] 浏览 Storybook 组件库（如已部署）

### Day 4：认领任务

- [ ] 与 Tech Lead 沟通，认领一个小任务（Bug 修复或测试补充）
- [ ] 阅读任务相关的 FRD 和代码
- [ ] 创建 feature 分支，开始开发

### Day 5：完成首个 PR

- [ ] 完成任务开发
- [ ] 编写/补充测试
- [ ] 提交 PR，使用[标准 PR 模板](../../DEVELOPMENT_WORKFLOW.md#pr-模板)
- [ ] 完成 Code Review 流程

---

## 开发环境配置

### 系统要求

| 依赖 | 最低版本 | 推荐版本 | 安装命令 |
|------|----------|----------|----------|
| Node.js | 20 | 22 LTS | `brew install node@22` 或使用 nvm |
| pnpm | 10 | 10 | `npm install -g pnpm@10` |
| PostgreSQL | 17 | 18 | `brew install postgresql@18` |
| Redis | 7 | 7 | `brew install redis` |
| Docker | - | 最新 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

### 推荐工具

| 工具 | 用途 |
|------|------|
| VS Code 或 Cursor | IDE |
| pgAdmin 或 TablePlus | 数据库管理 |
| Postman 或 Bruno | API 调试 |

### VS Code 推荐插件

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "drizzle-team.drizzle-kit"
  ]
}
```

### 环境配置步骤

#### 1. 克隆仓库

```bash
# 克隆代码仓库（假设代码仓库地址）
git clone git@github.com:iflabX/agentifui.git
cd agentifui
```

#### 2. 安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm@10

# 安装项目依赖
pnpm install
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，填写必要配置
# 至少需要配置：
# - DATABASE_URL
# - REDIS_URL
# - AUTH_SECRET（可使用 `openssl rand -base64 32` 生成）
```

#### 4. 启动数据库服务

**方式 A：使用 Docker Compose（推荐）**

```bash
# 启动 PostgreSQL + Redis
docker-compose up -d db redis
```

**方式 B：使用本地服务**

```bash
# 启动 PostgreSQL
brew services start postgresql@18

# 启动 Redis
brew services start redis
```

#### 5. 初始化数据库

```bash
# 运行数据库迁移
pnpm db:migrate

# （可选）填充测试数据
pnpm db:seed
```

#### 6. 启动开发服务器

```bash
# 启动全部服务（前端 + 后端）
pnpm dev

# 或分别启动
pnpm dev:web      # 前端（默认 http://localhost:3000）
pnpm dev:gateway  # 网关（默认 http://localhost:4000）
```

#### 7. 验证环境

- [ ] 访问 `http://localhost:3000`，看到登录页面
- [ ] 访问 `http://localhost:4000/health`，返回 `{"status": "ok"}`
- [ ] 使用测试账号登录成功

### 常见环境问题

| 问题 | 解决方案 |
|------|----------|
| `pnpm install` 失败 | 检查 Node.js 版本，确保 ≥ 20 |
| 数据库连接失败 | 检查 `.env.local` 中 `DATABASE_URL` 格式 |
| Redis 连接失败 | 确认 Redis 服务已启动 |
| 端口被占用 | 使用 `lsof -i :3000` 查找占用进程 |

---

## 第一个任务

### 推荐的新人任务类型

1. **Bug 修复**：小范围、低风险，熟悉代码流程
2. **测试补充**：为现有功能补充单元测试
3. **文档完善**：修复文档中的错误或遗漏
4. **UI 微调**：小范围样式修改

### 任务认领流程

1. **查看任务池**：GitHub Issues 中标有 `good-first-issue` 的任务
2. **沟通确认**：在 Issue 中 Comment 或 @ Tech Lead 确认
3. **创建分支**：

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/s1-your-task-name
   ```

4. **开发完成后提交 PR**：

   - 使用规范的 Commit Message：`[S1] feat: add login button`
   - 填写 PR 模板
   - 等待 Review

### Git 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能分支 | `feature/[slice]-[module]` | `feature/s1-auth` |
| 修复分支 | `fix/[slice]-[issue-id]` | `fix/s1-login-error` |
| 规范变更 | `spec/[spec-name]-v[version]` | `spec/gateway-contract-v0.2` |

### Commit Message 规范

```
[切片ID] 类型: 简短描述

类型：feat / fix / docs / style / refactor / test / chore
示例：
  [S1] feat: implement login form validation
  [S2] fix: resolve SSE connection timeout
  [S1][F-AUTH-001] feat: add SSO detection
```

---

## 常见问题 FAQ

### Q1：我应该使用哪个 AI 工具？

项目支持以下 AI 协作工具：

- **Antigravity**（推荐）
- **Claude Code**
- **Codex**

AI 工作流定义在 `.agent/workflows/` 目录，可直接使用 `/generate_frd`、`/generate_code` 等 Slash Command。

### Q2：FRD 是什么？从哪里找示例？

FRD（Functional Requirement Document）是功能需求文档，详见：

- 模板：[templates/FRD_TEMPLATE.md](../../templates/FRD_TEMPLATE.md)
- 示例：[frd/AFUI-FRD-S1-1.md](../../frd/AFUI-FRD-S1-1.md)

### Q3：如何知道当前开发进度？

查看以下文件：

- `.agent/context/progress.md`：当前 Phase/Slice 进度
- `.agent/context/slice-status.json`：切片状态详情

### Q4：遇到阻塞问题怎么办？

1. 查阅相关文档和规范
2. 在 Slack/飞书 中提问，标注 P0/P1/P2 级别
3. 记录到 `.agent/context/open_issues.md`
4. 周末会讨论解决

### Q5：如何在 Review 中获得快速反馈？

- PR 描述清晰，使用模板
- 关联 Issue 和 FRD
- 保持 PR 小而专注
- 主动 @ Reviewer

### Q6：设计稿在哪里？

- Figma 链接：[待补充]
- 设计资产目录：`design/slices/S{X}/`
- 设计系统：[DESIGN_SYSTEM_P1.md](../../design/DESIGN_SYSTEM_P1.md)

### Q7：测试怎么跑？

```bash
# 单元测试
pnpm test

# 带覆盖率
pnpm test:coverage

# E2E 测试
pnpm test:e2e
```

详见 [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

---

## 联系方式

- **Tech Lead**：[待补充]
- **团队频道**：#dev-agentifui（Slack/飞书）
- **文档仓库**：[agentifui-docs](https://github.com/iflabX/agentifui-docs)
- **代码仓库**：[agentifui](https://github.com/iflabX/agentifui)（待创建）

---

## 附录：关键术语速查

| 术语 | 含义 |
|------|------|
| **Tenant** | 租户，最顶层隔离单元 |
| **Group** | 群组，用户组织和权限的归属单元 |
| **App** | AI 应用，由编排平台注册 |
| **Run** | 一次 AI 执行，包含 Trace |
| **Slice** | 开发切片，端到端可验收的交付单元 |
| **FRD** | 功能需求文档 |
| **SSOT** | Single Source of Truth，唯一事实来源 |
| **DoD** | Definition of Done，完成定义 |

---

*欢迎加入 AgentifUI 团队！如有任何问题，随时在团队频道提问。*
