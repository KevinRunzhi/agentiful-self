# AgentifUI Documentation Versioning & Structure Specification

## 1. Purpose

This document defines the **structure, responsibilities, and versioning rules**
for all product-related documentation in the AgentifUI project.

It serves as the **single source of truth** for:

* Human contributors (teachers, researchers, students)
* AI coding agents (Claude Code, Codex, etc.)
* External collaboration and delivery alignment

---

## 2. Repository Structure Overview

```text
agentifui-docs/
├── README.md                    # 项目概览
├── DOCS_VERSIONING.md           # 本文件
├── DEVELOPMENT_WORKFLOW.md      # 开发工作流程
│
├── prd/                         # 产品需求文档
│   ├── PRD.md                   # 用户端 PRD
│   └── PRD_ADMIN.md             # 管理后台 PRD
│
├── feature-list/                # 功能清单（SSOT）
│   └── feature-list.json
│
├── frd/                         # 功能需求文档
│   └── AFUI-FRD-S1-1.md         # 示例 FRD
│
├── roadmap/                     # 开发路线图
│   ├── ROADMAP_V1_0.md
│   ├── PHASE1_BACKLOG.md
│   └── PHASE1_ACCEPTANCE.md
│
├── tech/                        # 技术方案与架构文档
│   ├── TECHNOLOGY_STACK.md
│   ├── architecture/
│   ├── api-contracts/
│   ├── data-model/
│   ├── security/
│   ├── practices/
│   ├── agent-execution/
│   └── modules/
│
├── design/                      # 设计系统与 UI 规范
│   ├── DESIGN_WORKFLOW.md
│   ├── DESIGN_SYSTEM_P1.md
│   ├── patterns/
│   └── slices/
│
├── templates/                   # 文档模板
│   └── FRD_TEMPLATE.md
│
├── ref/                         # 参考资料
│
└── .agent/                      # AI Agent 工作目录
    ├── context/                 # Agent 上下文信息
    ├── workflows/               # AI 工作流定义
    └── prompts/                 # Prompt 模板
```

---

## 3. Document Types, Roles, and Versioning Rules

### 3.1 PRD — Product Requirement Document

**Location**

```text
prd/PRD.md
```

**Role**

* Defines the **overall product vision, scope, constraints, and principles**
* Acts as the **highest-level authority** for all features

**Versioning Rule**

* `PRD.md` always represents the **latest effective version**
* Historical changes are tracked via **Git commit history**
* Do **NOT** maintain multiple live PRD files in parallel

#### PRD Snapshots (Release / Freeze Only)

When a PRD version is formally frozen (e.g. delivery, review, publication):

```text
prd/releases/PRD_vX.Y_YYYY-MM-DD.md
```

Rules:

* Snapshots are **read-only**
* Created only at **explicit freeze points**
* `PRD.md` remains the active working document

---

### 3.2 Feature List — Global Feature Definition

**Location**

```text
feature-list/feature-list.json
```

**Role**

* Defines the **complete set of product features**
* Serves as the **single source of truth** for what features exist
* Used by AI agents for validation and planning

**Versioning Rule**

* Always maintain **one authoritative file**
* All changes tracked via **Git history**
* Do not duplicate feature lists per version

**Freeze Strategy**

* Use **Git tags** to mark feature list state at delivery points

Example:

```bash
git tag -a docs-v1.0 -m "Freeze feature list for v1.0 delivery"
```

---

### 3.3 FRD — Feature Requirement Document

**Location**

```text
frd/<FEATURE_ID>.md
```

Example:

```text
frd/EXEC-001.md
```

**Role**

* Defines detailed requirements for **one and only one feature**
* Bridges product intent and implementation details
* Primary document used by AI agents during coding

**Rules**

* One FRD file per `feature_id`
* File name **must exactly match** the feature ID
* FRD must not define features absent from Feature List

**Versioning Rule**

* FRDs evolve via Git commits
* Requirement changes are handled by modifying the same FRD file
* If a feature is frozen, mark explicitly in the document header:

```md
Status: Frozen  
Effective Date: YYYY-MM-DD
```

---

### 3.4 Roadmap — Delivery Planning

**Location**

```text
roadmap/
```

**Role**

* Describes **what subset of features** is planned for a given version
* Represents **delivery intent**, not full product scope

**Versioning Rule**

* One file per planned version
* Files are immutable once the version is completed

Example:

```text
roadmap-v1.0.md
roadmap-v1.5.md
```

---

### 3.5 Templates

**Location**

```text
templates/
```

**Role**

* Provides standardized templates for creating new documents
* Used by humans and AI agents for consistent structure

**Rules**

* Templates must not contain project-specific decisions
* Changes should be reviewed carefully, as they affect all future docs

---

### 3.6 Technical Specifications

**Location**

```text
tech/
  ├── architecture/
  ├── data-model/
  ├── api-contracts/
  └── ...
```

**Role**

* Defines the **technical implementation details**
* Translates PRD/FRD requirements into engineering designs
* Includes Architecture, Data Models, API Contracts, NFRs

**Versioning Rule**

* Follows semantic versioning (v0.x draft, v1.0 stable)
* Major versions must align with PRD major versions
* `DOMAIN_MODEL` and `API_CONTRACT` changes require careful review

---

### 3.7 Reference & Analysis

**Location**

```text
ref/
```

**Role**

* Stores **external reference materials** and **competitor analysis**
* Provides context and justifications for design decisions

**Versioning Rule**

* Snapshots of external state at a point in time
* Generally read-only after creation, unless updating analysis


---

## 4. Git as the Primary Version Control System

### 4.1 Default Strategy

* **Git commit history** is the primary versioning mechanism
* Documents represent the **current truth**, not historical snapshots
* Small, descriptive commits are strongly encouraged

### 4.2 Tags for Freeze Points

Use Git tags to mark formal documentation freezes:

```bash
git tag -a docs-v1.0 -m "Documentation freeze for v1.0"
git push origin docs-v1.0
```

---

## 5. Authority & Change Control (Recommended)

| Document Type | Who Can Modify        | How                 |
| ------------- | --------------------- | ------------------- |
| PRD           | Core maintainers      | PR + review         |
| Feature List  | Core maintainers      | PR only             |
| FRD           | Contributors / Agents | PR + review         |
| Roadmap       | Product owner         | Direct commit or PR |
| Templates     | Core maintainers      | PR + discussion     |

---

## 6. Agent Compatibility Notes

This repository is designed to be **Agent-friendly**:

* Stable paths (`prd/PRD.md`, `feature-list/feature-list.json`)
* One-feature-one-FRD mapping
* Explicit separation of scope (PRD) and delivery (Roadmap)
* Clear freeze semantics via tags and releases
* Agent context tracked in `.agent/context/`
* Workflows defined in `.agent/workflows/`

AI agents should:

1. Read `README.md` and `.agent/context/` first
2. Treat Feature List as authoritative
3. Refuse to invent features not defined in Feature List
4. Follow workflows defined in `.agent/workflows/`

---

## 7. Summary Principles

* **One truth, many views**
* **Git for history, files for intent**
* **Freeze explicitly, not implicitly**
* **Optimize for long-term collaboration and AI reasoning**

