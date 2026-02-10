# AgentifUI 设计资产目录

> **最后更新**：2026-01-27

---

## 目录结构

```
design/
├── README.md               # 本文件
├── DESIGN_WORKFLOW.md      # 设计工作流程（必读）
├── DESIGN_SYSTEM_P1.md     # 设计系统基线规范 v0.1
├── patterns/               # 交互模式库
│   ├── FORM_PATTERNS.md    # 表单交互规范
│   ├── MODAL_PATTERNS.md   # 模态框交互规范
│   └── LIST_PATTERNS.md    # 列表交互规范
└── slices/                 # 切片设计资产
    ├── S1/                 # S1 切片 UI 原型
    ├── S2/                 # S2 切片 UI 原型
    └── S3/                 # S3 切片 UI 原型
```

---

## 快速导航

| 文档 | 说明 | 适合谁读 |
|------|------|----------|
| [DESIGN_WORKFLOW.md](./DESIGN_WORKFLOW.md) | 设计工作流程全貌 | 所有人必读 |
| [DESIGN_SYSTEM_P1.md](./DESIGN_SYSTEM_P1.md) | 设计系统规范（SSOT） | 设计师、前端 |
| [patterns/](./patterns/) | 交互模式库 | 设计师、前端 |

---

## 文档说明

### DESIGN_WORKFLOW.md（新增）

设计工作流程文档，描述：
- 设计先行并行工作流
- 设计师周任务分配
- 设计冻结流程
- 设计与 FRD 的关系

### DESIGN_SYSTEM_P1.md

设计系统基线规范，定义：
- 设计令牌（颜色、字体、间距、圆角、阴影、动画）
- 响应式断点
- 核心组件规范（Button、Input、Card、Modal）
- 通用状态规范（Loading、Empty、Error、Success）
- AI 对话场景专用规范

### patterns/

交互模式库，定义常见交互场景的最佳实践：
- 表单：校验时机、提交行为、特殊字段处理
- 模态框：结构、开关行为、焦点管理
- 列表：加载状态、分页、搜索筛选

### slices/

各切片的 UI 原型和设计说明：
- 在 FRD 生成前完成 UI 原型
- 冻结后作为 FRD 的 UI/UX 章节引用

---

## 设计与开发流程

```
Phase 1-A  →  创建 DESIGN_SYSTEM_P1.md
    ↓
Phase 1-D  →  骨架代码包含 Design Token CSS
    ↓                    ↓
                   设计师开始 S1 UI 原型
    ↓                    ↓
Phase 1-E  →  S1 设计冻结 → S1 FRD → S1 开发
                         ↓
                   S2 UI 原型设计（并行）
```

> 详细流程请阅读 [DESIGN_WORKFLOW.md](./DESIGN_WORKFLOW.md)

---

## 版本追踪

| 文档 | 版本 | 更新日期 | 状态 |
|------|------|----------|------|
| DESIGN_WORKFLOW.md | v1.0 | 2026-01-27 | 已发布 |
| DESIGN_SYSTEM_P1.md | v0.1 | 2026-01-27 | 草稿 |
| FORM_PATTERNS.md | v0.1 | 2026-01-27 | 草稿 |
| MODAL_PATTERNS.md | v0.1 | 2026-01-27 | 草稿 |
| LIST_PATTERNS.md | v0.1 | 2026-01-27 | 草稿 |

---

*文档结束*

