# AgentifUI Gateway

> **统一 AI 接入网关** - OpenAI 兼容的企业级 AI 应用接入层

本目录包含 AgentifUI Gateway 独立项目的设计文档。

---

## 📖 文档索引

| 文档 | 描述 | 状态 |
|------|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 项目架构设计 | ✅ 草稿 |
| [REPO_STRUCTURE.md](./REPO_STRUCTURE.md) | 仓库目录结构 | ✅ 草稿 |
| [PHASE1_MVP.md](./PHASE1_MVP.md) | Phase 1 最小可用版本 | ✅ 草稿 |
| [api/INTERNAL_API.md](./api/INTERNAL_API.md) | Gateway ↔ Core API 内部协议 | ✅ 草稿 |

### 📜 共享契约（位于主项目）

| 文档 | 描述 | 说明 |
|------|------|------|
| [GATEWAY_CONTRACT_P1.md](../tech/api-contracts/GATEWAY_CONTRACT_P1.md) | 外部 API 契约 | Gateway 与前端/第三方的接口规范 |

> [!NOTE]
> `GATEWAY_CONTRACT_P1.md` 是 Gateway 与 AgentifUI 主项目的**共同契约**，由两个项目共同维护，保留在 `tech/api-contracts/` 目录。

---

## 🎯 项目定位

AgentifUI Gateway 是一个**独立的 API 网关项目**，提供：

- **OpenAI 兼容 API**：标准 `/v1/chat/completions` 接口
- **多后端适配**：统一接入 Dify / Coze / n8n 等编排平台
- **企业级治理**：认证、授权、配额、审计、限流
- **全链路追踪**：W3C Trace Context / OpenTelemetry

---

## 📂 文档管理策略

```
agentifui-docs/                     ← 统一文档仓库
│
├── gateway/                        ← 【Gateway 独立文档区】
│   ├── README.md                   # 本文件
│   ├── ARCHITECTURE.md             # Gateway 内部架构
│   ├── REPO_STRUCTURE.md           # Gateway 仓库结构
│   ├── PHASE1_MVP.md               # MVP 开发计划
│   └── api/
│       └── INTERNAL_API.md         # Gateway ↔ Core API 内部协议
│
├── tech/
│   └── api-contracts/
│       └── GATEWAY_CONTRACT_P1.md  ← 【共享契约】双方共同维护
│
└── (其他主项目文档)
```

### 协同原则

| 原则 | 说明 |
|------|------|
| **契约放在共同位置** | `GATEWAY_CONTRACT_P1.md` 是两个项目的"合同"，变更需双方评审 |
| **实现细节各自管理** | Gateway 架构、代码结构、开发计划放在 `gateway/` |
| **单向引用** | Gateway 文档可引用契约；主项目文档引用 `gateway/` 但不重复实现细节 |

### 未来独立仓库

```
agentifui-gateway/                  ← 未来独立代码仓库
├── src/                            # 源代码
├── docs/
│   └── README.md                   → 链接到 agentifui-docs/gateway/
└── ...

# 设计文档继续托管在 agentifui-docs/gateway/
# 便于产品/架构同学查看全貌
```

---

## 🔗 与 AgentifUI 主项目的关系

```
┌─────────────────────────────────────────────────────┐
│                  AgentifUI 主项目                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │   Web   │  │   API   │  │ Worker  │              │
│  │ (Next)  │  │(Fastify)│  │(BullMQ) │              │
│  └────┬────┘  └────┬────┘  └─────────┘              │
│       │            │                                │
│       └─────┬──────┘                                │
│             │                                       │
└─────────────┼───────────────────────────────────────┘
              │ HTTP (GATEWAY_CONTRACT)
              ▼
┌─────────────────────────────────────────────────────┐
│              AgentifUI Gateway (独立项目)            │
│  ┌────────────────────────────────────────────┐     │
│  │  Fastify + Plugins                          │     │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │     │
│  │  │Auth │ │Quota│ │Audit│ │Trace│ │Proxy│  │     │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │     │
│  └────────────────────────────────────────────┘     │
│         │                                           │
│         │ HTTP (INTERNAL_API)                       │
│         ▼                                           │
│  ┌────────────────────────────────────────────┐     │
│  │ Core API (内部通信)                         │     │
│  │ /internal/authz, /internal/audit, ...       │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────────┐
    │  后端编排平台 (External) │
    │  Dify / Coze / n8n      │
    └─────────────────────────┘
```

---

## 📋 版本计划

| 版本 | 目标 | 范围 | 状态 |
|------|------|------|------|
| v0.1 | 最小可用 (Phase 1) | JWT 认证 + Dify 适配 + 基础审计 | 🚧 设计中 |
| v0.5 | 完整治理能力 | 配额系统 + 多层限流 + 熔断 | 📋 计划 |
| v1.0 | 生产就绪 + 多后端 | Coze/n8n 适配 + 完善监控 | 📋 计划 |

---

## 🔄 契约变更流程

当需要修改 `GATEWAY_CONTRACT_P1.md` 时：

1. 提交 PR 到 agentifui-docs
2. 通知 Gateway 团队和 AgentifUI 团队评审
3. 双方 Approve 后合并
4. 两个项目同步更新实现

---

## 📚 相关文档

- [外部 API 契约](../tech/api-contracts/GATEWAY_CONTRACT_P1.md)
- [系统边界与职责](../tech/architecture/SYSTEM_BOUNDARY.md)
- [技术选型](../tech/TECHNOLOGY_STACK.md)
- [开发工作流](../DEVELOPMENT_WORKFLOW.md)
