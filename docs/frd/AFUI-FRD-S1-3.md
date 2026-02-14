# FRD: 应用入口与工作台（S1-3）

---

## 元信息

| 属性 | 值 |
|------|-----|
| **FRD ID** | AFUI-FRD-S1-3 |
| **来源切片** | S1-3 |
| **覆盖 Feature ID** | F-APP-001, F-APP-004, F-QUOTA-001, F-QUOTA-002, F-QUOTA-003, F-QUOTA-004 |
| **FRD 版本** | v0.1 |
| **最后更新** | 2026-02-13 |
| **状态** | 草稿 |
| **作者** | AI Agent |

### 引用基线

| 规范 | 版本 | 说明 |
|------|------|------|
| ROADMAP_V1_0 | v0.1 | S1-3 目标与边界 |
| PHASE1_BACKLOG | v0.1 | Feature 与优先级映射 |
| PHASE1_ACCEPTANCE | v0.1 | AC-S1-3-01..07 / B01 |
| GATEWAY_CONTRACT_P1 | v0.1 | `/v1/models`、`/v1/chat/completions` 契约 |
| DEGRADATION_MATRIX_P1 | v0.1 | 配额服务异常降级路径 |
| AUDIT_EVENTS_P1 | v0.1 | 告警与超限审计事件 |

---

## Scope / Out of Scope

### In Scope

- [x] 应用工作台入口（最近使用 / 我的收藏 / 全部应用）
- [x] 授权应用可见性（无权应用不可见）
- [x] 应用搜索与分类浏览
- [x] Tenant/Group/User 三级配额限制
- [x] Token 计量口径（默认输入+输出）
- [x] 配额超限拦截
- [x] 80%/90%/100% 配额阈值告警
- [x] 配额服务不可用降级（可进应用列表，禁新对话）

### Out of Scope

- 应用级硬配额（v2.0+）
- 管理后台配额配置 UI（S3-1）
- 高级成本报表与结算看板（S3）
- 复杂告警策略编排（多渠道编排留后续）

---

## User Story

### US-1：应用工作台发现

**As a** User  
**I want to** 在统一入口看到我可访问的应用并快速筛选  
**So that** 我可以快速发起正确的 AI 交互

**补充说明**:
- 视图支持 `Recent` / `Favorites` / `All`
- 支持搜索与分类
- 无权应用完全不可见

### US-2：配额治理与拦截

**As a** System  
**I want to** 在请求执行前检查三级配额并拦截超限  
**So that** 平台成本与资源使用受控

**补充说明**:
- 判定顺序 Tenant → Group → User
- 任一层超限即拒绝新请求
- 扣减归因到当前工作群组

### US-3：阈值告警

**As a** Tenant Admin / Manager  
**I want to** 在 80%/90%/100% 阈值收到告警  
**So that** 可以提前做治理动作

### US-4：配额服务降级

**As a** User  
**I want to** 在配额服务异常时仍可浏览应用  
**So that** 我不至于完全失去导航能力

**补充说明**:
- 新对话必须禁用
- 展示明确降级提示

---

## UI/UX 描述

### 页面结构

| 页面 | 路由 | 主要模块 |
|------|------|---------|
| 应用工作台 | `/apps` | 应用列表、搜索栏、分类筛选、最近使用、收藏 |
| 应用卡片 | `/apps` 内 | icon/name/description/tags/status |

### 状态说明

| 状态 | 触发条件 | UI 表现 |
|------|----------|---------|
| Loading | 首次加载/搜索中 | Skeleton + 禁用二次提交 |
| Empty | 无授权应用或无搜索结果 | 空状态文案 + 返回默认视图 |
| Quota Warning | 接近阈值 | 顶部 warning banner |
| Quota Exceeded | 超限 | 新对话按钮禁用 + 可解释提示 |
| Degraded | quota service 不可用 | 全局降级提示 + 新对话禁用 |

---

## 数据契约

### 1) `GET /api/rbac/apps/accessible`

**说明**：获取用户可访问应用列表，支持视图与搜索。

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| view | string | 否 | `all` / `recent` / `favorites` |
| q | string | 否 | 搜索关键词 |
| category | string | 否 | 分类 |

**响应（200）**

```json
{
  "data": {
    "items": [
      {
        "id": "app_1",
        "name": "Sales Copilot",
        "mode": "chat",
        "isFavorite": true,
        "lastUsedAt": "2026-02-13T08:00:00Z"
      }
    ]
  },
  "meta": { "traceId": "tr_123" }
}
```

### 2) `POST /internal/quota/check`

**说明**：执行 Tenant/Group/User 三级配额检查。

**响应（403）**

```json
{
  "error": {
    "type": "permission_denied",
    "code": "quota_exceeded",
    "message": "Quota exceeded at group scope",
    "trace_id": "tr_123"
  }
}
```

### 3) `POST /internal/quota/deduct`

**说明**：请求执行后扣减使用量并记录账本。

---

## Trace / 审计 / 降级要求

### Trace 要求

- [x] 需要 Trace  
- 配额检查与扣减链路必须包含 `X-Trace-ID`

### 审计要求

- [x] 需要审计  
- 告警与超限事件：
  - `gov.quota.warning`
  - `gov.quota.exceeded`
- 降级触发事件：
  - `gov.degradation.triggered`

### 降级要求

- [x] 需要降级  
- 场景：quota service timeout/unavailable  
- 行为：允许进入应用列表，禁止新对话（对应 `AC-S1-3-B01`）

---

## 验收标准（AC）

### 核心验收

- [ ] **AC-S1-3-01**：应用列表正确展示授权应用  
- [ ] **AC-S1-3-02**：最近使用/收藏/全部分类正常  
- [ ] **AC-S1-3-03**：应用搜索响应时间 P95 ≤ 300ms  
- [ ] **AC-S1-3-04**：配额检查拦截超限请求（拦截率 100%）  
- [ ] **AC-S1-3-05**：配额告警触发（80%/90%/100%），延迟 ≤ 5min  
- [ ] **AC-S1-3-06**：配额扣减归因到当前工作群组  
- [ ] **AC-S1-3-07**：三级配额限制（Tenant/Group/User）层级生效

### 边界验收

- [ ] **AC-S1-3-B01**：配额服务不可用时，允许进入应用列表，禁止新对话

---

## E2E 用例

### Case 1: 授权可见性

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 登录普通用户 | 成功进入 `/apps` |
| 2 | 查看应用列表 | 仅出现授权应用 |
| 3 | 搜索关键词 | 返回匹配应用且无越权结果 |

### Case 2: 配额超限拦截

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 将用户配额调低至即将超限 | 配额状态可见 |
| 2 | 发起新对话 | 返回 `quota_exceeded` |
| 3 | 检查日志 | 存在超限审计事件 |

### Case 3: 配额服务降级

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 注入 quota service 不可用 | 进入降级态 |
| 2 | 刷新 `/apps` | 页面可访问 |
| 3 | 点击新对话 | 被禁止并提示降级原因 |

---

## 依赖与风险

### 依赖

| 依赖项 | 类型 | 状态 | 说明 |
|--------|------|------|------|
| S1-2 授权接口 | 功能依赖 | 已有 | `/api/rbac/apps/accessible` 等 |
| Quota 数据模型 | 数据依赖 | 待实现 | 需新增 quota 相关表 |
| 告警通知通道 | 系统依赖 | 部分可用 | 站内通知优先 |

### 风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 现有 RBAC 路由未接入主服务 | 阻塞联调 | 高 | 阶段 A 先完成路由接入 |
| 全仓 typecheck 不健康 | 降低迭代效率 | 高 | 先修复 S1-3 直接阻塞项 |
| 告警重复触发 | 通知噪音 | 中 | 阈值去重键 + 幂等事件表 |

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v0.1 | 2026-02-13 | 初稿 | AI Agent |

---

*文档结束*

---

## Final API Snapshot (2026-02-14)

This section records the final S1-3 API behavior implemented in code.

### 1) Quota health endpoints

`GET /internal/quota/health`

```json
{
  "data": {
    "status": "degraded",
    "degraded": true,
    "reason": "Database context unavailable",
    "source": "quota_check",
    "updatedAt": "2026-02-14T09:00:00.000Z"
  },
  "meta": {
    "traceId": "trace_123",
    "timestamp": "2026-02-14T09:00:01.000Z"
  }
}
```

`POST /internal/quota/health`

```json
{
  "degraded": false,
  "source": "manual"
}
```

### 2) Quota check endpoint

`POST /internal/quota/check`

Request:

```json
{
  "tenantId": "ten_1",
  "userId": "usr_1",
  "groupId": "grp_1",
  "appId": "app_1",
  "meteringMode": "token",
  "estimatedUsage": 300
}
```

Allowed response:

```json
{
  "allowed": true,
  "limits": [
    { "scope": "tenant", "remaining": 12000, "limit": 50000 },
    { "scope": "group", "remaining": 3000, "limit": 10000 },
    { "scope": "user", "remaining": 1200, "limit": 4000 }
  ]
}
```

Blocked response:

```json
{
  "error": {
    "type": "permission_denied",
    "code": "quota_exceeded",
    "message": "Quota exceeded at group scope",
    "trace_id": "trace_123"
  }
}
```

### 3) Quota deduct endpoint

`POST /internal/quota/deduct`

```json
{
  "tenantId": "ten_1",
  "userId": "usr_1",
  "groupId": "grp_1",
  "appId": "app_1",
  "model": "gpt-4.1-mini",
  "meteringMode": "token",
  "promptTokens": 120,
  "completionTokens": 240
}
```

Response:

```json
{
  "success": true,
  "attribution": {
    "groupId": "grp_1",
    "source": "requested"
  }
}
```

### 4) Execution entry and degraded behavior

`POST /v1/chat/completions` now performs quota check and deduction before returning a completion payload.

When quota guard state is degraded, the same endpoint is denied:

```json
{
  "error": {
    "type": "service_unavailable",
    "code": "quota_guard_degraded_deny_new",
    "message": "Quota service degraded, new requests are temporarily denied",
    "trace_id": "trace_123"
  }
}
```

Read-only app workbench endpoints remain available in degraded mode:
- `GET /api/rbac/apps/accessible`
- `GET /api/rbac/apps/{id}/context-options`
