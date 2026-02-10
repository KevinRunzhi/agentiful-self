# AgentifUI 统一开发流程

* **文档版本**：v1.3
* **最后更新**：2026-01-26
* **适用范围**：AgentifUI 产品全阶段开发
* **团队模式**：远程协作、兼职松散团队
* **AI 工具支持**：Antigravity / Claude Code / Codex

---

## 核心原则

**1. 最小契约，最大杠杆**
只写 Phase 1 必须用到的规范，但要写"硬"（明确、可校验、有版本号）。

**2. 切片驱动，端到端可验证**
每个工作包都必须是"可独立演示"的端到端路径，不是孤立功能点。

**3. 规则沉淀，版本回写**
发现的新规则立刻沉淀到基线规范并标注版本号，避免知识散落在对话中。

**4. AI 友好，上下文可控**
给 AI Agent 的输入必须精确、有边界、有版本引用，避免幻觉。

**5. 人机协作，明确边界**
每个阶段明确人工任务与 AI 任务的职责划分。

---

## AI Agent 协作规范

> **目标**：明确 AI 在开发流程中的角色、输入输出边界和质量控制机制。

### AI 任务边界

**Phase 0：输入资产锁定**
- 人工任务：决策边界确认、验收标准审批
- AI 任务：无

**Phase 1-A：建立最小架构跑道**
- 人工任务：Review 基线规范、确认技术选型
- AI 任务：生成基线规范初稿
- AI 输入：PRD + Feature List + 技术约束
- AI 输出：基线规范 v0 草稿

**Phase 1-B：Phase Backlog 切片**
- 人工任务：切片验收评审、依赖关系确认
- AI 任务：切片映射建议
- AI 输入：Roadmap + Feature List
- AI 输出：PHASE1_BACKLOG.md 草稿

**Phase 1-C：FRD 模板设计**
- 人工任务：FRD 模板审批
- AI 任务：FRD 模板生成
- AI 输入：基线规范 v0
- AI 输出：FRD_TEMPLATE.md

**Phase 1-D：spec-kit 生成骨架**
- 人工任务：骨架代码 Review
- AI 任务：spec-kit 骨架生成
- AI 输入：基线规范 + 目录规范
- AI 输出：项目骨架代码

**Phase 1-E：FRD 生成与实施循环**
- 人工任务：Code Review、安全审查
- AI 任务：FRD 生成 + 代码实现
- AI 输入：基线规范 v0.x + 切片定义 + FRD 模板
- AI 输出：FRD + 实现代码 + 测试

**Phase 1-F：验收**
- 人工任务：验收确认
- AI 任务：验收报告生成
- AI 输入：DoD 清单 + 测试结果
- AI 输出：验收报告

### AI 上下文管理规范

#### 单次任务最大输入

- **基线规范**：仅当前切片相关的 v0.x 文件，不要一次性加载全部规范
- **Feature List**：仅当前切片覆盖的 Feature ID 片段，使用 JSON 过滤
- **代码上下文**：仅当前模块相关文件，避免跨模块引用
- **历史对话**：仅最近 3 轮相关对话，使用摘要而非全文

#### 上下文投喂顺序

1. 任务目标（1-2 句话）
2. 必须遵守的约束（引用具体版本号）
3. 输入材料（按优先级排序）
4. 输出格式要求
5. 禁止事项

#### 禁止事项清单

- ❌ 引用未确认版本的规范
- ❌ 假设不存在的 API 或数据结构
- ❌ 在 FRD 中使用「待定」「假设」字样
- ❌ 单次任务跨越多个切片
- ❌ 修改已锁定版本的基线规范（需走变更流程）

### AI 产出校验清单

#### FRD 校验

- [ ] 引用的基线规范版本号存在且正确
- [ ] 覆盖的 Feature ID 在 Feature List 中存在
- [ ] Scope / Out of Scope 边界清晰
- [ ] AC 可量化、可测试、无歧义
- [ ] UI/UX 描述包含所有状态（Loading / Empty / Error / Success）
- [ ] 数据契约包含完整的请求/响应示例
- [ ] Trace / 审计 / 降级要求已明确勾选
- [ ] 无「假设」「待定」「可能」等模糊字样
- [ ] E2E 测试用例覆盖正常流程和至少一个失败场景

#### 代码校验

- [ ] 目录结构符合 `REPO_STRUCTURE.md`
- [ ] API 契约符合 `GATEWAY_CONTRACT_P1.md`
- [ ] 审计事件符合 `AUDIT_EVENTS_P1.md`
- [ ] 错误处理符合统一错误结构
- [ ] Trace ID 正确传递
- [ ] 单元测试覆盖核心逻辑
- [ ] 无硬编码的配置值

#### 设计一致性校验

- [ ] UI/UX 章节引用了 DESIGN_SYSTEM 版本号
- [ ] 未定义新的颜色值（必须使用设计令牌）
- [ ] 未定义新的字号/间距（必须使用设计令牌）
- [ ] 组件使用符合 DESIGN_SYSTEM 定义的变体/尺寸
- [ ] 状态规范引用 DESIGN_SYSTEM 的 Loading/Empty/Error/Success
- [ ] 原型图存放在 `design/slices/S{X}/` 目录

### 规范变更协议

#### 触发条件

- 发现 FRD / 代码与基线规范冲突
- 发现需要新增字段 / 事件 / 错误码
- 发现原规范有歧义或遗漏

#### 变更流程

1. **人工确认变更必要性**
2. **AI 生成规范补丁**（Diff 格式）
3. **人工 Review 后合并**
4. **更新版本号**（v0.1 → v0.2）
5. **AI 更新所有引用该规范的 FRD**

#### 版本号格式

- **新增字段（向后兼容）**：v0.1 → v0.2，无需全量 Review
- **修改字段定义**：v0.1 → v0.2，需检查引用该字段的 FRD
- **删除字段 / 破坏性变更**：v0.x → v1.0，需全量 Review

### AI 任务失败恢复

#### FRD 生成失败

- **输出格式不符合模板**：提供模板示例后重试
- **引用了不存在的规范版本**：明确提供正确版本号后重试
- **Scope 过大导致超时**：拆分为子 FRD 后分别生成
- **AC 不可测试**：人工提供可测试 AC 示例后重试

#### 代码实现失败

- **编译 / 类型错误**：提供错误信息，让 AI 修复
- **测试失败**：提供测试输出，让 AI 分析原因
- **架构不符合规范**：回滚到上一个 passing 点，提供更多约束后重试
- **超出单次任务能力**：拆分为更小的实现任务

---

## Agent 记忆管理

> **目标**：利用 AI Agent 的跨会话能力，持久化项目上下文。

### 必须持久化的上下文

- **当前 Phase / Slice 进度**：存储在 `.agent/context/progress.md`，每个切片完成时更新
- **规范版本追踪**：存储在 `.agent/context/spec_versions.json`，规范变更时更新
- **未解决的 Review 问题**：存储在 `.agent/context/open_issues.md`，发现问题 / 解决问题时更新
- **AI 任务历史**：存储在 `.agent/context/task_history.md`，每个 AI 任务完成时更新

### 建议的 .agent/ 目录结构

```
.agent/
├── context/
│   ├── progress.md            # 当前 Phase / Slice 进度
│   ├── spec_versions.json     # 规范版本追踪
│   ├── open_issues.md         # 待解决问题
│   └── task_history.md        # AI 任务历史摘要
├── workflows/
│   ├── generate_frd.md        # FRD 生成工作流
│   ├── generate_code.md       # 代码生成工作流
│   ├── code_review.md         # 代码审查工作流
│   └── spec_update.md         # 规范变更工作流
└── prompts/
    ├── frd_generation.md      # FRD 生成提示词模板
    ├── code_generation.md     # 代码生成提示词模板
    └── review_checklist.md    # Review 检查提示词模板
```

### spec_versions.json 示例

```json
{
  "specs": {
    "GATEWAY_CONTRACT": { "version": "v0.2", "updatedAt": "2026-01-25" },
    "DOMAIN_MODEL": { "version": "v0.1", "updatedAt": "2026-01-23" },
    "AUDIT_EVENTS": { "version": "v0.1", "updatedAt": "2026-01-23" },
    "DEGRADATION_MATRIX": { "version": "v0.1", "updatedAt": "2026-01-23" }
  },
  "frds": {
    "FRD-S1-AUTH": { "referencedSpecs": ["GATEWAY_CONTRACT@v0.1", "DOMAIN_MODEL@v0.1"] },
    "FRD-S2-CHAT": { "referencedSpecs": ["GATEWAY_CONTRACT@v0.2", "AUDIT_EVENTS@v0.1"] }
  }
}
```

### slice-status.json 示例

切片状态文件让 AI Agent 可以感知当前进度：

```json
{
  "currentPhase": "Phase1",
  "slices": {
    "S1": {
      "name": "身份→组织→授权→应用可见",
      "status": "completed",
      "frozen": true,
      "frozenAt": "2026-01-20",
      "completedAt": "2026-01-25",
      "dod": {
        "ac_verified": true,
        "e2e_passed": true,
        "audit_logged": false
      }
    },
    "S2": {
      "name": "网关→对话→Trace→持久化",
      "status": "in_progress",
      "frozen": true,
      "frozenAt": "2026-01-25",
      "completedAt": null,
      "dod": {
        "ac_verified": false,
        "e2e_passed": false,
        "trace_available": false
      }
    },
    "S3": {
      "name": "管理后台→审计",
      "status": "pending",
      "frozen": false,
      "frozenAt": null,
      "completedAt": null,
      "dod": {}
    }
  }
}
```

### AGENTS.md 模板（代码仓库使用）

> 本文档仓库不需要创建 AGENTS.md，但代码仓库应在根目录创建。

代码仓库的 `AGENTS.md` 应包含：

**允许的操作**
- 读取任意文件
- 创建/修改 feature 分支的代码
- 运行 lint、typecheck、test 命令

**禁止的操作**
- 直接 push 到 main/develop 分支
- 修改 `.env`、密钥、证书等敏感文件
- 删除或修改已锁定版本的基线规范

**提交规范**
- 必须包含 Slice ID：`[S1] feat: implement login page`
- 必须包含 Feature ID（如有）：`[S1][F-AUTH-001] feat: add SSO support`

**测试策略**
- 先写测试、确认失败、再实现
- E2E 测试必须覆盖 FRD 中定义的 AC

**代码规范引用**
- 目录结构：`tech/practices/REPO_STRUCTURE.md`
- API 契约：`tech/api-contracts/GATEWAY_CONTRACT_P1.md`
- 审计事件：`tech/security/AUDIT_EVENTS_P1.md`

---

## 远程兼职团队协作方法

> **目标**：在 AI 驱动的开发模式下，让远程兼职的 5 人团队以**异步优先、周末同步**的方式高效协作。

### 推荐角色分工

**Tech Lead / 跑道维护者（1 人）**
- 职责：架构决策、基线规范 Review、跨切片协调、冲突仲裁
- 核心产出：维护「可让 Agent 自主前进的跑道」
  - 规范版本追踪（`spec_versions.json`）
  - 切片状态追踪（`slice-status.json`）
  - AI 工作流与 Prompt 模板
- AI 协作模式：指导 AI 方向，Review AI 产出，维护 AI 可读的状态文件

**前端工程师（2 人）**
- 职责：UI/UX 实现、前端组件、E2E 测试
- AI 协作模式：AI 生成组件 → 人工调优 → AI 补充测试

**后端工程师（1 人）**
- 职责：API 实现、数据模型、网关逻辑
- AI 协作模式：AI 生成 CRUD → 人工实现复杂逻辑

**全栈/DevOps（1 人）**
- 职责：联调、部署、CI/CD、观测配置
- AI 协作模式：AI 生成配置 → 人工验证 → AI 补充脚本

> 💡 **灵活调整**：根据切片内容，前后端人员可临时交叉支援。

### 设计先行并行工作流

> 设计提前一个切片，与开发并行进行，避免阻塞。

```
┌─────────────────────────────────────────────────────────────────┐
│                 设计先行并行工作流                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  设计师线程:   S2 UI原型 ──→ 设计评审 ──→ 冻结 ─────────────────│
│                    │                    │                       │
│                    │        ┌───────────┘                       │
│                    ▼        ▼                                   │
│  FRD线程:      ─────────→ S2 FRD生成（引用已冻结的设计）           │
│                              │                                  │
│                              ▼                                  │
│  开发线程:     S1 实现 ───────────────→ S2 实现                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**设计冻结规则**：
- ✅ 切片 UI 原型必须在 FRD 生成前完成评审并冻结
- ✅ 冻结后的设计资产存放在 `design/slices/S{X}/`
- ✅ 冻结状态记录在 `slice-status.json` 的 `designFrozen` 字段
- ❌ 冻结后禁止修改设计稿（需走规范变更协议）

### 切片并行工作流

**Week 1：S1 身份→组织→授权→应用可见**
- 🎨 设计师：**S2 UI 原型**（提前一个切片）
- 前端 A：登录页面
- 前端 B：应用列表
- 后端：Auth API
- 全栈：联调 + 部署
- Tech Lead：S2 FRD 预生成 + S1 Review

**Week 2-3：S2 网关→对话→Trace→持久化**
- 🎨 设计师：**S3 UI 原型**（提前一个切片）
- 前端 A：对话界面
- 前端 B：Trace 展示
- 后端：网关 + SSE
- 全栈：观测配置
- Tech Lead：S3 FRD 预生成 + S2 Review

**Week 4：S3 管理后台→审计**
- 🎨 设计师：**Phase 2 设计系统迭代**
- 前端 A：管理页面
- 前端 B：审计日志
- 后端：审计 API
- 全栈：安全扫描
- Tech Lead：验收 + Phase 2 规划

### 异步优先的协作机制

#### 异步日报（替代每日站会）

每位成员在有进度时提交异步日报（GitHub Issue 或飞书文档），无需每日强制：

- **昨日产出**：PR 链接 / 文档链接
- **今日计划**：任务 ID 或切片名
- **阻塞项**：需要谁配合、什么时间需要
- **AI 补充需求**：需要更新哪些上下文

#### 周末同步会（唯一固定会议）

**时间**：每周六/周日，1-2 小时

**内容**：
- 切片启动：FRD Review、任务分配、依赖确认、接口冻结点确认
- 切片验收：DoD 校验、Demo 演示
- 阻塞裁决：需要 Tech Lead 拍板的问题
- 规范变更：需要全员确认的变更

#### SLA 分级响应

- **P0（阻塞生产）**：当天响应
- **P1（阻塞开发）**：48 小时内响应
- **P2（一般问题）**：下次周末会讨论

#### 异步协作规则

- **规范变更**：提 PR → 在 PR 中 @ 相关人员 → 48h 内 Review
- **FRD 评审**：创建 Discussion → 异步评论 → 周末会敲定
- **代码 Review**：PR 必须至少 1 人 Approve（跨前后端需双 Approve）
- **阻塞问题**：Slack/飞书通知 + 标注 P0/P1/P2 → 按 SLA 响应
- **AI 产出问题**：记录到 `.agent/context/open_issues.md` → 周末会讨论

### Git 分支策略

**分支结构**
- `main`：生产分支，仅接受 develop 合并
- `develop`：开发分支，所有功能分支合并到此
- `feature/[slice]-[module]`：功能分支，如 `feature/s1-auth`

**分支命名规范**
- 功能分支：`feature/[slice]-[module]`，如 `feature/s1-auth`
- 修复分支：`fix/[slice]-[issue-id]`，如 `fix/s2-sse-timeout`
- 规范变更：`spec/[spec-name]-v[version]`，如 `spec/gateway-contract-v0.2`

**PR 流程**
- 从 feature 分支提 PR 到 develop
- 必须至少 1 人 Approve
- 跨前后端变更需双 Approve
- 合并后删除 feature 分支

#### PR 模板

```markdown
## 变更类型
- [ ] 功能实现
- [ ] Bug 修复
- [ ] 规范变更

## 关联
- 切片: S1 / S2 / S3
- Feature ID: F-XXX-XXX
- FRD: [链接]

## AI 产出校验
- [ ] 通过 FRD 校验清单
- [ ] 通过代码校验清单

## 测试
- [ ] 单元测试通过
- [ ] E2E 测试通过

## Reviewer
- 前端变更: @前端工程师
- 后端变更: @后端工程师
- 架构/规范变更: @Tech Lead
```

### 兼职工作节奏

由于团队成员时间碎片化，不设定每日固定节奏，但遵循以下原则：

- **有产出时更新日报**：推送代码后更新异步日报
- **及时响应 P0/P1**：收到阻塞通知后按 SLA 响应
- **周末前准备**：会议前更新个人进度、整理待讨论问题
- **保护专注时间**：关闭通知进行专注开发，完成后再处理消息

### 工具链配置

- **代码托管**：GitHub / GitLab，开启 PR 模板、Branch Protection
- **即时通讯**：Slack / 飞书，创建 #dev-agentifui 频道、配置 GitHub 通知
- **任务跟踪**：Linear / Jira，切片 → Epic、Feature → Story、AC → Subtask
- **文档协作**：Notion / 飞书文档，存放 FRD、会议纪要、技术决策
- **AI 协作**：Antigravity / Claude Code，配置 `.agent/` 目录、共享 Prompt 模板
- **CI/CD**：GitHub Actions，PR 触发测试、main 触发部署

### 冲突解决机制

- **代码冲突**：Git merge 失败 → 相关人员同步 → 共同解决 → 重新 PR
- **设计分歧**：双方各写 1 页设计文档 → 技术评审会讨论 → Tech Lead 拍板
- **规范冲突**：遵循「后写入者负责兼容」原则 → 规范变更 PR 中解决
- **AI 产出质量争议**：记录具体问题 → 优化 Prompt → 沉淀到 `.agent/prompts/`

### 新成员 Onboarding

- **Day 1**：阅读本文档 + PRD 核心章节 + 当前 Slice 的 FRD
- **Day 2**：配置开发环境、熟悉 `.agent/` 目录、运行项目
- **Day 3**：认领一个小任务（如修复 Bug 或补充测试）完成完整 PR 流程
- **Day 4-5**：Pair Programming 参与当前切片开发

---

## Phase 0：输入资产锁定（SSOT 与阶段边界）

> **目标**：明确"做什么"与"不做什么"的边界，产出 Phase 1 唯一权威输入。

### 输入资产清单

**已完成资产**
- **PRD / PRD_ADMIN**：决策与边界（不写实现）
- **Feature List**：功能全集（SSOT）
- **Roadmap v1.0**：阶段性子集 + 验收边界

**待生成资产**
- **Phase 1 验收清单**：Roadmap 阶段一验收条目提取
- **Phase 1 依赖约束列表**：Trace/审计/降级等前置依赖

### 产出文件

`roadmap/PHASE1_ACCEPTANCE.md`

内容要求：
- 逐条列出 Roadmap 阶段一的验收边界
- 标注前置依赖（如：Trace 必须在对话前完成）

---

## Phase 1-A：建立"最小架构跑道"（基线规范 v0）

> **目标**：只确定"地基 + 承重墙"，不做"全量装修"。这是后续所有 FRD/代码生成的"上下文地板"。

### 必须先写的 5 类基线规范

**1. 系统边界与职责图**
- 文件路径：`tech/architecture/SYSTEM_BOUNDARY.md`
- 内容范围：Frontend → Gateway → Orchestration 数据流 + 责任归属（3 层图）
- AI 可生成初稿

**2. 核心领域模型 v0**
- 文件路径：`tech/data-model/DOMAIN_MODEL_P1.md`
- 内容范围：Tenant / Group / Role / App / Conversation / Run / AuditEvent / Trace（ERD 草图 + 字段说明）
- AI 可生成初稿

**3. 网关契约 v0**
- 文件路径：`tech/api-contracts/GATEWAY_CONTRACT_P1.md`
- 内容范围：OpenAI 兼容范围、SSE 流式、stop、错误结构、trace_id 传递规范
- AI 可生成初稿

**4. 审计事件 v0**
- 文件路径：`tech/security/AUDIT_EVENTS_P1.md`
- 内容范围：最小事件枚举 + 字段模型 + 不可篡改原则（仅覆盖 Phase 1 事件）
- AI 可生成初稿

**5. 降级矩阵 v0**
- 文件路径：`tech/architecture/DEGRADATION_MATRIX_P1.md`
- 内容范围：编排不可用时的只读可用路径 + 软停提示（仅覆盖 Phase 1 场景）
- AI 可生成初稿

**6. 设计系统 v0**
- 文件路径：`design/DESIGN_SYSTEM_P1.md`
- 内容范围：设计令牌（颜色/字体/间距）+ 核心组件规范 + 状态规范 + AI 对话场景专用规范
- AI 可生成初稿
- 配套文件：
  - `design/patterns/FORM_PATTERNS.md`：表单交互规范
  - `design/patterns/MODAL_PATTERNS.md`：模态框交互规范
  - `design/patterns/LIST_PATTERNS.md`：列表交互规范

### 全局技术策略（小而硬）

**技术选型决策**
- 文件路径：`tech/TECHNOLOGY_STACK.md`
- 内容范围：选型 + 不选原因（前端框架/后端语言/数据库/部署方式）
- ⚠️ 需人工决策

**Repo/目录规范**
- 文件路径：`tech/practices/REPO_STRUCTURE.md`
- 内容范围：目录结构、命名规范（spec-kit 需要）
- AI 可生成初稿

**非功能约束**
- 文件路径：`tech/practices/NFR_BASELINE.md`
- 内容范围：性能/安全/合规/观测的硬指标（从 PRD 提取）
- AI 可提取

> ⚠️ **约束**：这些基线规范必须有 `v0.x` 版本号，后续 FRD 必须引用具体版本。

### AI 生成基线规范的提示词模板

```markdown
## 任务
生成 [规范名称] v0.1 初稿

## 输入
- PRD 相关章节: [粘贴]
- Feature List 相关条目: [粘贴]
- 技术约束: [列出]

## 输出要求
1. 遵循 [模板路径] 的结构
2. 版本号标注为 v0.1
3. 每个定义必须有明确边界，禁止使用「可能」「待定」
4. 包含「不包含」章节，明确 Out of Scope

## 禁止
- 引用不存在的其他规范
- 假设未确认的技术选型
```

---

## Phase 1-B：Phase Backlog 切片（避免 Feature=FRD 的误区）

> **目标**：不直接从 Feature List 批量生成 FRD，而是先定义"端到端可验收路径"。

### 切片定义规则

- **一个切片 = 一条可验收的端到端路径**
- 切片绑定多个 Feature ID（1:N / N:1 均可）
- 每个切片必须映射到 PHASE1_ACCEPTANCE.md 中的验收条目
- 切片顺序决定开发顺序

### 切片接口冻结规则

为避免并行开发时「接口频繁变动」导致返工，每个切片在**启动会通过后**进入冻结状态：

**冻结范围**
- 切片涉及的 `GATEWAY_CONTRACT` 字段
- 切片涉及的 `DOMAIN_MODEL` 实体和字段
- 切片涉及的 `AUDIT_EVENTS` 事件类型

**冻结规则**
- ✅ 允许新增字段（向后兼容）
- ❌ 禁止修改/删除已有字段（破坏性变更）
- 若必须做破坏性变更，走「规范变更协议」：升版本 → 更新所有引用 FRD → 周末会确认

**状态追踪**
- 冻结状态记录在 `slice-status.json` 的 `frozen: true` 字段
- 冻结后的变更必须记录到 `spec_versions.json`

### 切片与 Feature List 的关系

切片是"交付策略"，Feature List 是"功能全集"，两者保持独立：

**Feature List**
- 定位：功能全集（SSOT）
- 稳定性：稳定，跨阶段不变
- 跨模块：按 module 分组
- 文件位置：`feature-list/feature-list.json`

**切片（Backlog）**
- 定位：交付策略（按阶段）
- 稳定性：按阶段独立管理
- 跨模块：可跨多个 module 聚合
- 文件位置：`roadmap/PHASE1_BACKLOG.md`

### Phase 1 推荐切片（3 条主线）

**S1：身份→组织→授权→应用可见→进入对话页**
- 覆盖 Feature ID：F-ORG-001~003, F-AUTH-001/003~005/007, F-IAM-001/003/005~007, F-APP-001
- 映射验收条目：用户可登录、可加入 Group、可访问授权应用

**S2：网关最小协议→流式对话→stop→Trace→持久化**
- 覆盖 Feature ID：F-GW-001~005, F-OBS-001[最小], F-CHAT-001~002/005~006, F-RUN-001~002, F-DATA-001
- 映射验收条目：用户可对话、可停止、可追踪、租户隔离

**S3：管理后台最小闭环→最小审计闭环**
- 覆盖 Feature ID：F-ADMIN-USER-001, F-ADMIN-GROUP-001, F-ADMIN-APP-001, F-ADMIN-AUTHZ-001, F-AUDIT-001[最小], F-RUN-003[最小]
- 映射验收条目：管理员可操作、关键操作可追溯、失败可自查

> 这三条切片跑通后，"系统可用/可演示/可排障"的基础就稳了。

### 产出文件

`roadmap/PHASE1_BACKLOG.md`

内容要求：
- 切片列表 + Feature 映射 + 验收映射 + 开发顺序
- 每个切片的依赖关系
- 每个切片的 DoD

---

## Phase 1-C：FRD 模板设计

> **目标**：固定 FRD 模板结构，确保 AI Agent 生成的 FRD 结构一致且可校验。

### FRD 必备结构（强制章节）

```markdown
# FRD: [Feature Name / Slice Name]

## 元信息
- FRD ID: 
- 来源切片: S1 / S2 / S3
- 覆盖 Feature ID: 
- 引用基线规范版本: 
  - GATEWAY_CONTRACT: v0.1
  - DOMAIN_MODEL: v0.1
  - AUDIT_EVENTS: v0.1

## Scope / Out of Scope
## User Story
## UI/UX 描述
- 页面结构
- 状态说明（Loading / Empty / Error / Success）
- 交互规则
- 原型图引用（如有）

## 数据契约
- 请求/响应字段
- 示例 JSON
- 错误码

## Trace / 审计 / 降级要求
- [ ] 需要 Trace（是/否）
- [ ] 需要审计（是/否，事件类型）
- [ ] 需要降级（是/否，降级行为）

## 验收标准（AC）
- [ ] AC-1: ...
- [ ] AC-2: ...

## E2E 测试用例
- Case 1: ...
- Case 2 (失败场景): ...

## 依赖与风险
```

### 产出文件

`templates/FRD_TEMPLATE.md`

---

## Phase 1-D：spec-kit 生成骨架

> **目标**：在"契约/目录规范确定后"再生成骨架，输入更少但更硬。

### spec-kit 输入

- **阶段范围**：`PHASE1_BACKLOG.md`，只给 Phase 1 范围
- **目录规范**：`REPO_STRUCTURE.md`，monorepo 还是多 repo
- **系统边界**：`SYSTEM_BOUNDARY.md`，分层职责
- **网关契约 v0**：`GATEWAY_CONTRACT_P1.md`，API 风格约定
- **领域模型 v0**：`DOMAIN_MODEL_P1.md`，核心实体
- **技术选型**：`TECHNOLOGY_STACK.md`，框架决策

### spec-kit 输出要求

- **不是空项目**，而是能跑通最小链路的"Hello World+"
- 基础路由（/login, /apps, /chat/:id, /admin）
- Auth wrapper（登录态拦截）
- 统一 API client（带错误拦截/trace 注入）
- Mock Server 或最小网关 stub（保证前端能联调）
- 基础 UI 组件（Design System v0）

### AI 生成骨架的提示词模板

```markdown
## 任务
生成项目骨架代码

## 输入
- 目录规范: [REPO_STRUCTURE.md 内容]
- 技术选型: [TECHNOLOGY_STACK.md 内容]
- 网关契约: [GATEWAY_CONTRACT_P1.md 核心章节]

## 输出要求
1. 严格遵循目录规范
2. 包含以下可运行能力:
   - 基础路由框架
   - Auth wrapper（可 mock 实现）
   - 统一 API client
   - 错误处理框架
   - Trace ID 注入机制
3. 包含 README.md 说明如何启动

## 禁止
- 引入未在技术选型中确认的依赖
- 实现具体业务逻辑（仅骨架）
```

---

## Phase 1-E：FRD 生成与 openspec 实施循环

> **目标**：按切片顺序增量生成 FRD，完成一个再生成下一个，避免上下文爆炸。

### FRD 生成规则

1. **按切片顺序生成**：S1 → S2 → S3
2. **每个切片生成一份 FRD**（可包含多个 Feature）
3. **FRD 必须引用基线规范版本号**
4. **生成前检查依赖**：S2 依赖 S1 的 Auth 能力，S3 依赖 S2 的数据模型

### openspec 实施循环

1. **FRD**（引用基线规范 v0.x）
2. **实现**（代码）
3. **测试**（E2E 冒烟优先）
4. **人工 Review**（边界/安全/观测/降级/一致性）
5. **回写规范版本号**（发现新规则 → 沉淀到基线规范 v0.x+1）
6. **更新 FRD 引用版本号**

> 这样"规则"不会散落在对话里，而是逐步积累成可复用的工程资产。

### AI FRD 生成提示词模板

```markdown
## 任务
生成切片 [S1/S2/S3] 的 FRD

## 输入
- 切片定义: [PHASE1_BACKLOG.md 相关章节]
- 基线规范版本:
  - GATEWAY_CONTRACT: v0.x
  - DOMAIN_MODEL: v0.x
  - AUDIT_EVENTS: v0.x
- Feature List 相关条目: [粘贴]

## 输出要求
1. 严格遵循 FRD_TEMPLATE.md 结构
2. 在元信息中标注引用的规范版本
3. AC 必须可测试、可量化
4. 包含至少一个失败场景的 E2E 测试用例

## 禁止
- 引用不存在的规范版本
- 使用「待定」「假设」「可能」等模糊词汇
- 超出切片 Scope 的功能
```

---

## Phase 1-F：两套 DoD 把质量钉死

### DoD-切片（每个切片必须满足）

- [ ] AC 可验证（含失败场景）
- [ ] 涉及链路则 trace 可用且可复制
- [ ] 涉及治理操作则审计落库
- [ ] 依赖编排则降级行为可解释且可演示
- [ ] E2E 测试通过
- [ ] 代码通过 AI 产出校验清单

### DoD-阶段（Phase 1 必须满足）

- [ ] `PHASE1_ACCEPTANCE.md` 验收清单逐条可证明
- [ ] 编排不可用时只读链路仍可用（保证可演示/可排障）
- [ ] 基线规范 v0.x 沉淀完成并有版本记录
- [ ] `.agent/context/spec_versions.json` 已更新
- [ ] 所有 FRD 引用的规范版本与实际一致

---

## 完整流程概览

### Phase 0：输入资产锁定

PRD ✓ → Feature List ✓ → Roadmap ✓ → Phase 1 验收清单 + 依赖约束列表

### Phase 1-A：最小架构跑道

产出基线规范 v0：系统边界与职责图、核心领域模型、网关契约、审计事件、降级矩阵，加上技术选型和目录规范。

流程：AI 生成初稿 → 人工 Review → 锁定版本

### Phase 1-B：Phase Backlog 切片

定义三条端到端切片：
- S1：身份→组织→授权→应用→对话页
- S2：网关→对话→stop→Trace→持久化
- S3：管理后台→审计→失败原因

流程：AI 建议映射 → 人工确认依赖 → 锁定顺序

### Phase 1-C：FRD 模板设计

产出 `templates/FRD_TEMPLATE.md`，包含 UI/UX、Trace/审计/降级、AC 等强制章节。

流程：AI 生成模板 → 人工审批

### Phase 1-D：spec-kit 生成骨架

输入 Backlog + 基线规范 v0 + 目录规范，输出可跑通最小链路的"Hello World+"。

流程：AI 生成骨架 → 人工 Review → 可运行验证

### Phase 1-E：FRD 生成 + openspec 实施循环

按切片顺序增量交付：
- S1 FRD → 实现 → 测试 → Review → 回写规范
- S2 FRD → 实现 → 测试 → Review → 回写规范
- S3 FRD → 实现 → 测试 → Review → 回写规范

流程：AI 生成 FRD/代码 → 人工 Review → AI 更新规范引用

### Phase 1-F：验收

DoD-切片 ✓ → DoD-阶段 ✓ → Phase 1 完成

流程：AI 生成验收报告 → 人工确认

---

## 待创建文件清单（优先级排序）

### P0（必须优先完成）

- `roadmap/PHASE1_ACCEPTANCE.md`：阶段一验收清单 + 依赖约束，AI 可生成
- `tech/architecture/SYSTEM_BOUNDARY.md`：系统边界与职责图，AI 可生成初稿
- `tech/data-model/DOMAIN_MODEL_P1.md`：核心领域模型 v0，AI 可生成初稿
- `tech/api-contracts/GATEWAY_CONTRACT_P1.md`：网关契约 v0，AI 可生成初稿
- `tech/security/AUDIT_EVENTS_P1.md`：审计事件 v0，AI 可生成初稿
- `tech/architecture/DEGRADATION_MATRIX_P1.md`：降级矩阵 v0，AI 可生成初稿
- `design/DESIGN_SYSTEM_P1.md`：设计系统 v0，AI 可生成初稿
- `design/patterns/*.md`：交互模式库（表单/模态框/列表），AI 可生成初稿
- `.agent/context/spec_versions.json`：规范版本追踪，AI 可生成
- `.agent/context/slice-status.json`：切片状态追踪（机器可读），AI 可生成

### P1（Phase 1 启动前完成）

- `tech/TECHNOLOGY_STACK.md`：技术选型（补充完善），⚠️ 需人工决策
- `tech/practices/REPO_STRUCTURE.md`：目录规范，AI 可生成初稿
- `tech/practices/NFR_BASELINE.md`：非功能约束，AI 可提取
- `templates/FRD_TEMPLATE.md`：FRD 模板（补充），AI 可生成
- `roadmap/PHASE1_BACKLOG.md`：Phase 1 切片定义，AI 可生成
- `design/slices/S{X}/`：各切片 UI 原型，需在 FRD 生成前完成

### P2（按需创建）

- `.agent/workflows/*.md`：AI 工作流定义，AI 可生成
- `.agent/prompts/*.md`：提示词模板，AI 可生成

---

## 与传统开发流程的关键差异

**规范设计顺序**
- 传统：先设计 tech 下各类技术文档
- 优化：先写基线规范 v0（5 件套）+ Phase 1 增量设计

**FRD 生成策略**
- 传统：从 Feature List 生成 Phase 1 FRD
- 优化：先做 Phase Backlog 切片，再生成 FRD

**spec-kit 输入**
- 传统：输入大量文档
- 优化：输入更少但更硬的契约/目录/模型，降低 AI 幻觉

**FRD 粒度**
- 传统：FRD 按 Feature 1:1 生成
- 优化：FRD 按切片/模块生成，覆盖多个 Feature

**版本追溯**
- 传统：无版本号追溯
- 优化：基线规范有版本号，FRD 必须引用版本

**质量保障**
- 传统：无明确 DoD
- 优化：两套 DoD（切片级 + 阶段级）把质量钉死

**人机协作**
- 传统：人机边界模糊
- 优化：明确 AI 任务边界表，人机职责清晰

**上下文管理**
- 传统：上下文无管理
- 优化：上下文投喂规范，避免 AI 幻觉

**产出校验**
- 传统：无产出校验
- 优化：AI 产出校验清单，自动化检查

**失败处理**
- 传统：无失败恢复
- 优化：失败恢复协议，提高鲁棒性

---

## 附录 A：PHASE1_BACKLOG.md 结构示例

```markdown
# Phase 1 Backlog（切片定义）

## 切片定义规则
- 切片 = 端到端可验收路径
- 切片可覆盖多个 module 的 Feature
- 开发顺序按切片依赖关系排列

---

## S1: 身份→组织→授权→应用可见

**验收目标**：用户可登录 → 加入 Group → 看到授权应用列表

**覆盖的 Feature**
- F-ORG-001：多租户隔离与治理单元（租户与组织）
- F-ORG-002：群组组织与成员归属（租户与组织）
- F-ORG-003：多群组成员与管理者绑定（租户与组织）
- F-AUTH-001：多认证方式登录（身份认证）
- ...

**依赖**：无（起点切片）

**DoD**：用户可登录并看到应用列表

---

## S2: 网关→对话→Trace→持久化

**验收目标**：用户可发起对话 → 流式响应 → 可停止 → Trace 可复制

**覆盖的 Feature**
- F-GW-001：OpenAI API 兼容的统一调用入口（网关与集成）
- F-CHAT-001：实时文本对话（对话系统）
- ...

**依赖**：S1（需要登录态）

**DoD**：用户可完成一次完整对话并复制 Trace ID

---

## S3: 管理后台→审计

**验收目标**：管理员可操作 → 关键操作可追溯 → 失败可自查

**覆盖的 Feature**
- F-ADMIN-USER-001：用户管理（管理后台）
- F-ADMIN-GROUP-001：群组管理（管理后台）
- ...

**依赖**：S1（需要 RBAC）, S2（需要数据模型）

**DoD**：管理员可完成用户/群组/应用管理，关键操作有审计记录
```

---

## 附录 B：AI 任务快速启动指南

### 启动新的 AI 开发会话

1. **确认当前进度**：查看 `.agent/context/progress.md`
2. **确认规范版本**：查看 `.agent/context/spec_versions.json`
3. **确认待解决问题**：查看 `.agent/context/open_issues.md`
4. **选择工作流**：
   - 生成 FRD：`.agent/workflows/generate_frd.md`
   - 生成代码：`.agent/workflows/generate_code.md`
   - 代码 Review：`.agent/workflows/code_review.md`
   - 规范变更：`.agent/workflows/spec_update.md`
5. **使用对应提示词模板**：
   - FRD 生成：`.agent/prompts/frd_generation.md`
   - 代码生成：`.agent/prompts/code_generation.md`

### 会话结束时

1. 更新 `.agent/context/progress.md`
2. 如有规范变更，更新 `.agent/context/spec_versions.json`
3. 如有未解决问题，记录到 `.agent/context/open_issues.md`
4. 更新 `.agent/context/task_history.md`

---

*文档结束*
