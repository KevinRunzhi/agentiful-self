# Data Model: S1-3 应用入口与工作台

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)  
**Phase**: 1 - Data Model Design  
**Date**: 2026-02-13

## Overview

S1-3 在 S1-2 已有最小 `app` / `app_grant` 基础上扩展：

1. 应用展示字段（工作台卡片需要）。  
2. 收藏/最近使用关系。  
3. 三级配额策略、计数、账本、告警事件。  

## Entity Relationship (S1-3 Added)

```text
Tenant ──< App ──< AppFavorite
   │         │
   │         └──< AppRecentUse
   │
   └──< QuotaPolicy ──< QuotaCounter
                     ├──< QuotaUsageLedger
                     └──< QuotaAlertEvent
```

## Entity Definitions

### 1) App（S1-3 字段扩展）

> 兼容 S1-2 既有字段：`id`, `tenantId`, `name`, `status`, `createdAt`。

| Field | Type | Constraint | Description |
|------|------|------------|-------------|
| description | text | nullable | 应用简介 |
| mode | varchar(32) | not null, default `chat` | `chat` / `workflow` / `agent` |
| icon | text | nullable | 图标 URL |
| tags | jsonb | default `[]` | 标签数组 |
| config | jsonb | default `{}` | 应用配置快照 |
| createdBy | uuid | FK user.id, nullable | 创建者 |
| updatedAt | timestamptz | not null | 更新时间 |

**Indexes**:
- `idx_app_tenant_status_mode` (`tenant_id`, `status`, `mode`)
- `idx_app_search_name` (`name`)

---

### 2) AppFavorite

| Field | Type | Constraint |
|------|------|------------|
| id | uuid | PK |
| tenantId | uuid | FK tenant.id, not null |
| userId | uuid | FK user.id, not null |
| appId | uuid | FK app.id, not null |
| createdAt | timestamptz | default now() |

**Unique**:
- (`tenant_id`, `user_id`, `app_id`)

---

### 3) AppRecentUse

| Field | Type | Constraint |
|------|------|------------|
| id | uuid | PK |
| tenantId | uuid | FK tenant.id, not null |
| userId | uuid | FK user.id, not null |
| appId | uuid | FK app.id, not null |
| lastUsedAt | timestamptz | not null |
| useCount | integer | default 1 |

**Unique**:
- (`tenant_id`, `user_id`, `app_id`)

---

### 4) QuotaPolicy

| Field | Type | Constraint | Description |
|------|------|------------|-------------|
| id | uuid | PK | 策略 ID |
| tenantId | uuid | FK tenant.id, not null | 租户 |
| scopeType | varchar(16) | not null | `tenant` / `group` / `user` |
| scopeId | uuid | not null | 对应实体 ID |
| metricType | varchar(16) | not null, default `token` | `token` / `request` |
| periodType | varchar(16) | not null, default `month` | `month` / `week` |
| limitValue | bigint | not null | 上限值 |
| alertThresholds | jsonb | not null, default `[80,90,100]` | 告警阈值 |
| isActive | boolean | not null, default true | 是否生效 |
| createdAt | timestamptz | default now() | 创建时间 |
| updatedAt | timestamptz | default now() | 更新时间 |

**Unique**:
- (`tenant_id`, `scope_type`, `scope_id`, `metric_type`, `period_type`)

---

### 5) QuotaCounter

| Field | Type | Constraint | Description |
|------|------|------------|-------------|
| id | uuid | PK | 计数记录 ID |
| policyId | uuid | FK quota_policy.id, not null | 对应策略 |
| periodStart | timestamptz | not null | 周期开始 |
| periodEnd | timestamptz | not null | 周期结束 |
| usedValue | bigint | not null, default 0 | 已使用值 |
| version | integer | not null, default 0 | 乐观锁版本 |
| updatedAt | timestamptz | not null | 更新时间 |

**Unique**:
- (`policy_id`, `period_start`)

---

### 6) QuotaUsageLedger

| Field | Type | Constraint | Description |
|------|------|------------|-------------|
| id | uuid | PK | 使用账本主键 |
| tenantId | uuid | FK tenant.id, not null | 租户 |
| groupId | uuid | FK group.id, nullable | 归因群组 |
| userId | uuid | FK user.id, not null | 用户 |
| appId | uuid | FK app.id, not null | 应用 |
| model | varchar(128) | nullable | 模型名 |
| meteringMode | varchar(16) | not null | `token` / `request` |
| promptTokens | integer | default 0 | 输入 token |
| completionTokens | integer | default 0 | 输出 token |
| totalTokens | integer | default 0 | 总 token |
| traceId | varchar(128) | nullable | Trace ID |
| createdAt | timestamptz | default now() | 记录时间 |

**Indexes**:
- `idx_quota_usage_tenant_group_created` (`tenant_id`, `group_id`, `created_at desc`)
- `idx_quota_usage_user_created` (`user_id`, `created_at desc`)

---

### 7) QuotaAlertEvent

| Field | Type | Constraint |
|------|------|------------|
| id | uuid | PK |
| tenantId | uuid | FK tenant.id, not null |
| policyId | uuid | FK quota_policy.id, not null |
| periodStart | timestamptz | not null |
| threshold | integer | not null |
| usedValue | bigint | not null |
| limitValue | bigint | not null |
| channel | varchar(16) | not null, default `in_app` |
| status | varchar(16) | not null, default `sent` |
| traceId | varchar(128) | nullable |
| createdAt | timestamptz | default now() |

**Unique**:
- (`policy_id`, `period_start`, `threshold`, `channel`)

## Domain Rules

1. 配额检查顺序固定：Tenant → Group → User。  
2. 任一层超限即拒绝请求（短路）。  
3. 扣减归因必须落到当前活跃群组（若缺失则回落默认群组）。  
4. 每个阈值在同一周期只允许触发一次告警。  
5. 配额服务降级时不做扣减，仅允许列表读取。

## Suggested Drizzle Schema Stubs

```ts
export const quotaPolicy = pgTable("quota_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  scopeType: varchar("scope_type", { length: 16 }).notNull(),
  scopeId: uuid("scope_id").notNull(),
  metricType: varchar("metric_type", { length: 16 }).notNull().default("token"),
  periodType: varchar("period_type", { length: 16 }).notNull().default("month"),
  limitValue: bigint("limit_value", { mode: "number" }).notNull(),
  alertThresholds: jsonb("alert_thresholds").$type<number[]>().notNull().default([80, 90, 100]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## Migration Notes

1. `app` 表为增量扩展，避免重建。  
2. 新增 quota 相关表时需补回填脚本（默认策略）。  
3. 迁移后需执行索引基准测试，验证 `AC-S1-3-03` 和 quota check P95 指标。
