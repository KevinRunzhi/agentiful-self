# AgentifUI Documentation

AgentifUI 是面向企业的 AI 应用与智能体统一管理平台。本文档仓库包含了产品的需求、规划、设计与技术文档。

## 🚀 核心文档导航

### 产品规划

| 文档类型 | 文件 | 说明 | 状态 |
|----------|------|------|------|
| **PRD** | [PRD.md](prd/PRD.md) | 用户端产品需求文档 v1.0 | ✅ 已发布 |
| **PRD** | [PRD_ADMIN.md](prd/PRD_ADMIN.md) | 管理后台需求文档 v1.0 | ✅ 已发布 |
| **Feature List** | [feature-list.json](feature-list/feature-list.json) | 全量功能清单（SSOT） | ✅ 已发布 |
| **Roadmap** | [ROADMAP_V1_0.md](roadmap/ROADMAP_V1_0.md) | v1.0 开发路线图 | ✅ 已发布 |
| **Backlog** | [PHASE1_BACKLOG.md](roadmap/PHASE1_BACKLOG.md) | Phase 1 切片定义与依赖 | ✅ 已发布 |
| **Acceptance** | [PHASE1_ACCEPTANCE.md](roadmap/PHASE1_ACCEPTANCE.md) | Phase 1 验收标准 | ✅ 已发布 |
| **FRD** | [AFUI-FRD-S1-1.md](frd/AFUI-FRD-S1-1.md) | S1 切片功能需求文档示例 | ✅ 已发布 |

### 技术架构

| 文档类型 | 文件 | 说明 | 状态 |
|----------|------|------|------|
| **Tech Stack** | [TECHNOLOGY_STACK.md](tech/TECHNOLOGY_STACK.md) | 技术选型与决策 v0.4 | ✅ 已发布 |
| **Architecture** | [SYSTEM_BOUNDARY.md](tech/architecture/SYSTEM_BOUNDARY.md) | 系统边界与分层架构 | ✅ 已发布 |
| **Architecture** | [ARCHITECTURE.md](tech/architecture/ARCHITECTURE.md) | 完整技术架构设计 | ✅ 已发布 |
| **Data Model** | [DOMAIN_MODEL_P1.md](tech/data-model/DOMAIN_MODEL_P1.md) | P1 核心领域模型 | ✅ 已发布 |
| **API Spec** | [GATEWAY_CONTRACT_P1.md](tech/api-contracts/GATEWAY_CONTRACT_P1.md) | P1 网关接口契约 | ✅ 已发布 |
| **Security** | [AUDIT_EVENTS_P1.md](tech/security/AUDIT_EVENTS_P1.md) | P1 审计事件定义 | ✅ 已发布 |
| **Reliability** | [DEGRADATION_MATRIX_P1.md](tech/architecture/DEGRADATION_MATRIX_P1.md) | P1 服务降级矩阵 | ✅ 已发布 |

### Gateway 独立项目

| 文档类型 | 文件 | 说明 | 状态 |
|----------|------|------|------|
| **Overview** | [gateway/README.md](gateway/README.md) | Gateway 项目概述与文档索引 | 🆕 设计中 |
| **Architecture** | [gateway/ARCHITECTURE.md](gateway/ARCHITECTURE.md) | Gateway 独立架构设计 | 🆕 设计中 |
| **Repo Structure** | [gateway/REPO_STRUCTURE.md](gateway/REPO_STRUCTURE.md) | Gateway 仓库目录规范 | 🆕 设计中 |
| **Phase 1 MVP** | [gateway/PHASE1_MVP.md](gateway/PHASE1_MVP.md) | Gateway 最小可用版本规范 | 🆕 设计中 |
| **Internal API** | [gateway/api/INTERNAL_API.md](gateway/api/INTERNAL_API.md) | Gateway ↔ Core API 协议 | 🆕 设计中 |

> **Note**: Gateway 作为独立项目开发，文档托管在本仓库 `gateway/` 目录。

### 工程实践

| 文档类型 | 文件 | 说明 | 状态 |
|----------|------|------|------|
| **NFR** | [NFR_BASELINE.md](tech/practices/NFR_BASELINE.md) | 非功能约束基线 | ✅ 已发布 |
| **Repo** | [REPO_STRUCTURE.md](tech/practices/REPO_STRUCTURE.md) | 代码仓库目录规范 | ✅ 已发布 |
| **Onboarding** | [ONBOARDING.md](tech/practices/ONBOARDING.md) | 新人入职指南 | ✅ 已发布 |
| **Engineering** | [ENGINEERING_GUIDELINES.md](tech/practices/ENGINEERING_GUIDELINES.md) | 工程指南与编码规范 | ✅ 已发布 |
| **Testing** | [TESTING_STRATEGY.md](tech/practices/TESTING_STRATEGY.md) | 测试策略与覆盖率要求 | ✅ 已发布 |
| **CI/CD** | [CI_CD_PRACTICES.md](tech/practices/CI_CD_PRACTICES.md) | CI/CD 最佳实践 | ✅ 已发布 |

### 设计系统

| 文档类型 | 文件 | 说明 | 状态 |
|----------|------|------|------|
| **Design Workflow** | [DESIGN_WORKFLOW.md](design/DESIGN_WORKFLOW.md) | 设计工作流程 | ✅ 已发布 |
| **Design System** | [DESIGN_SYSTEM_P1.md](design/DESIGN_SYSTEM_P1.md) | P1 设计系统规范 | ✅ 已发布 |
| **Patterns** | [patterns/](design/patterns/) | 交互模式库（表单/模态框/列表） | ✅ 已发布 |

## 📂 目录结构说明

```
agentifui-docs/
├── README.md                    # 项目概览
├── DOCS_VERSIONING.md           # 文档版本管理规范
├── DEVELOPMENT_WORKFLOW.md      # 开发工作流程
│
├── prd/                         # 产品需求文档
│   ├── PRD.md                   # 用户端 PRD v1.0
│   └── PRD_ADMIN.md             # 管理后台 PRD v1.0
│
├── feature-list/                # 功能清单（SSOT）
│   └── feature-list.json        # 全量功能定义
│
├── roadmap/                     # 开发路线图
│   ├── ROADMAP_V1_0.md          # v1.0 三阶段规划
│   ├── PHASE1_BACKLOG.md        # Phase 1 切片定义
│   └── PHASE1_ACCEPTANCE.md     # Phase 1 验收标准
│
├── frd/                         # 功能需求文档
│   └── AFUI-FRD-S1-1.md         # S1 切片 FRD 示例
│
├── gateway/                     # Gateway 独立项目文档
│   ├── README.md                # Gateway 项目概述
│   ├── ARCHITECTURE.md          # Gateway 架构设计
│   ├── REPO_STRUCTURE.md        # Gateway 仓库结构
│   ├── PHASE1_MVP.md            # Phase 1 MVP 规范
│   └── api/
│       └── INTERNAL_API.md      # Gateway ↔ Core API 协议
│
├── tech/                        # 技术方案与架构文档
│   ├── TECHNOLOGY_STACK.md      # 技术选型决策
│   ├── README.md                # tech 目录导航
│   ├── architecture/            # 系统架构设计
│   ├── data-model/              # 数据模型设计
│   ├── api-contracts/           # API 契约规范
│   ├── security/                # 安全与审计
│   ├── practices/               # 工程实践规范
│   ├── agent-execution/         # Agent 执行模型
│   └── modules/                 # 平台功能模块
│
├── design/                      # 设计系统与 UI 规范
│   ├── DESIGN_WORKFLOW.md       # 设计工作流程
│   ├── DESIGN_SYSTEM_P1.md      # P1 设计系统规范
│   ├── patterns/                # 交互模式库
│   └── slices/                  # 切片 UI 原型（待填充）
│
├── templates/                   # 文档模板
│   └── FRD_TEMPLATE.md          # FRD 模板 v1.1
│
├── ref/                         # 参考资料（竞品分析等）
│
└── .agent/                      # AI Agent 工作目录
    ├── context/                 # Agent 上下文信息
    │   ├── progress.md          # 项目进度追踪
    │   ├── spec_versions.json   # 规范版本追踪
    │   ├── slice-status.json    # 切片状态追踪
    │   ├── open_issues.md       # 待解决问题
    │   └── task_history.md      # AI 任务历史
    ├── workflows/               # AI 工作流定义
    │   ├── generate_frd.md      # FRD 生成工作流
    │   ├── generate_code.md     # 代码生成工作流
    │   ├── code_review.md       # 代码审查工作流
    │   ├── design_review.md     # 设计评审工作流
    │   └── spec_update.md       # 规范变更工作流
    └── prompts/                 # Prompt 模板
        ├── generate_feature_list_prompt.md
        └── generate_roadmap_prompt.md
```

## 📅 最近更新

- **2026-01-27**: 更新文档导航，同步仓库结构，完善 README 和 DOCS_VERSIONING。
- **2026-01-27**: 完善文档体系，新增新人入职指南、工程规范、测试策略和 CI/CD 最佳实践。
- **2026-01-27**: 完成 Phase 1-B/C，发布切片定义、验收标准和 FRD 模板 v1.1。
- **2026-01-26**: 完成 Phase 1-A 技术基线，发布 7 份核心架构设计文档。
- **2026-01-25**: 版本重置为 v1.0，发布 Roadmap v1.0 三阶段开发计划。

---

> 本文档项目采用 Agentic Development 模式维护，Human + AI Agent 协作迭代。
