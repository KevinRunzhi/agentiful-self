# Tech 技术文档目录

技术架构与规范文档目录，包含系统设计、数据模型、API 契约、安全规范和工程实践。

---

## 📂 目录结构

```
tech/
├── TECHNOLOGY_STACK.md      # 技术选型决策
├── README.md                # 本文件
│
├── architecture/            # 系统架构设计
│   ├── ARCHITECTURE.md      # 完整技术架构（参考）
│   ├── SYSTEM_BOUNDARY.md   # 系统边界与分层职责 ⭐
│   └── DEGRADATION_MATRIX_P1.md  # 服务降级矩阵 ⭐
│
├── data-model/              # 数据模型设计
│   └── DOMAIN_MODEL_P1.md   # 核心领域模型 ⭐
│
├── api-contracts/           # API 契约规范
│   ├── GATEWAY_CONTRACT_P1.md  # 网关 API 契约 ⭐
│   ├── REST_API.md          # (占位) REST API 详细
│   └── WEBSOCKET_EVENTS.md  # (占位) WebSocket 事件
│
├── agent-execution/         # Agent 执行模型
│   └── AGENT_EXECUTION.md   # (占位) Agent 执行流程
│
├── security/                # 安全与治理
│   └── AUDIT_EVENTS_P1.md   # 审计事件定义 ⭐
│
└── practices/               # 工程实践规范
    ├── REPO_STRUCTURE.md    # 代码仓库目录规范 ⭐
    ├── NFR_BASELINE.md      # 非功能约束基线 ⭐
    ├── ENGINEERING_GUIDELINES.md  # 工程指南
    ├── SPEC_KIT_REQUIREMENTS.md   # spec-kit 骨架需求
    ├── ONBOARDING.md        # 新人入职指南
    ├── TESTING_STRATEGY.md  # 测试策略
    ├── CI_CD_PRACTICES.md   # CI/CD 最佳实践
    ├── OBSERVABILITY_AND_MONITORING.md  # (占位) 可观测性
    └── VERIFICATION.md      # (占位) 验收检查
```

> ⭐ = Phase 1 基线规范（必须遵循）

---

## 🎯 Phase 1 基线规范

以下文件是 **Phase 1 必须遵循**的基线规范，FRD 和代码实现必须引用这些规范的版本号：

| 规范名称 | 文件路径 | 版本 | 用途 |
|----------|----------|------|------|
| **系统边界** | `architecture/SYSTEM_BOUNDARY.md` | v0.1 | 分层架构与职责划分 |
| **领域模型** | `data-model/DOMAIN_MODEL_P1.md` | v0.1 | 核心实体定义与关系 |
| **网关契约** | `api-contracts/GATEWAY_CONTRACT_P1.md` | v0.1 | OpenAI 兼容 API 规范 |
| **审计事件** | `security/AUDIT_EVENTS_P1.md` | v0.1 | 安全审计事件枚举 |
| **降级矩阵** | `architecture/DEGRADATION_MATRIX_P1.md` | v0.1 | 服务不可用时的降级策略 |
| **非功能约束** | `practices/NFR_BASELINE.md` | v1.0 | 性能/安全/合规硬指标 |
| **目录规范** | `practices/REPO_STRUCTURE.md` | v1.0 | 代码仓库目录结构 |
| **技术选型** | `TECHNOLOGY_STACK.md` | v0.4 | 前后端框架与依赖 |

### 版本管理规范

- **文件后缀 `_P1`**：表示该规范适用于 Phase 1 开发阶段
- **文件内 `v0.x`**：表示文档内容的语义版本
- **版本追踪**：`.agent/context/spec_versions.json`

### FRD 引用格式

```markdown
## 元信息
- 引用基线规范版本:
  - DOMAIN_MODEL: P1 v0.1
  - GATEWAY_CONTRACT: P1 v0.1
  - AUDIT_EVENTS: P1 v0.1
```

---

## 📖 完整设计文档（参考）

这些文档包含更详细的设计内容，供深入理解使用：

| 文件 | 说明 | 备注 |
|------|------|------|
| `architecture/ARCHITECTURE.md` | 完整技术架构设计 | 含详细实现方案、Mermaid 图 |
| `practices/ENGINEERING_GUIDELINES.md` | 工程指南 | 编码规范、Review 规范 |
| `practices/SPEC_KIT_REQUIREMENTS.md` | spec-kit 骨架需求 | Phase 1-D 输入文档 |

---

## 📝 占位文件说明

以下文件为**空白占位**，待后续阶段按需补充：

| 占位文件 | 计划补充时机 | 说明 |
|----------|--------------|------|
| `api-contracts/REST_API.md` | Phase 2 | 详细 REST API 规范 |
| `api-contracts/WEBSOCKET_EVENTS.md` | Phase 2 | SSE/WebSocket 事件定义 |
| `agent-execution/AGENT_EXECUTION.md` | Phase 2 | Agent 执行状态机 |
| `practices/OBSERVABILITY_AND_MONITORING.md` | Phase 1-E | 可观测性配置 |
| `practices/VERIFICATION.md` | Phase 1-F | 验收检查清单 |

> 💡 **原则**：优先使用带 `_P1` 后缀的基线规范，空白占位文件待需要时再补充内容。

---

## 🔗 相关文档

- [开发工作流](../DEVELOPMENT_WORKFLOW.md) - 阶段定义与 AI 协作规范
- [文档版本管理](../DOCS_VERSIONING.md) - 版本控制策略
- [规范版本追踪](../.agent/context/spec_versions.json) - 当前规范版本状态
- [新人入职指南](./practices/ONBOARDING.md) - 新人 Onboarding 必读
- [工程规范](./practices/ENGINEERING_GUIDELINES.md) - 代码规范与 Review 指南
- [测试策略](./practices/TESTING_STRATEGY.md) - 测试金字塔与覆盖率要求
- [CI/CD 实践](./practices/CI_CD_PRACTICES.md) - 流水线与部署规范

---

## 🚀 Gateway 独立项目

> [!IMPORTANT]
> AgentifUI Gateway 从 Phase 1 开始作为**独立项目**开发，文档托管在本仓库内。

| 文档 | 说明 |
|------|------|
| [Gateway README](../gateway/README.md) | 项目概述与文档索引 |
| [Gateway 架构设计](../gateway/ARCHITECTURE.md) | 系统架构、插件管道、适配器设计 |
| [Gateway 仓库结构](../gateway/REPO_STRUCTURE.md) | 独立仓库目录规范 |
| [Gateway Phase 1 MVP](../gateway/PHASE1_MVP.md) | 最小可用版本规范与开发计划 |

Gateway 是 OpenAI 兼容的统一 AI 接入层，负责：
- 协议适配（Dify/Coze/n8n → OpenAI API）
- 企业级治理（AuthN/AuthZ/Quota/Audit/RateLimit）
- 全链路追踪（W3C Trace Context）

