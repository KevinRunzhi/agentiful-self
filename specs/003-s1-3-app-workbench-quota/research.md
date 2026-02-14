# Technical Research: S1-3 应用入口与工作台

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Phase**: 0 - Technical Research & Decisions  
**Date**: 2026-02-13

## Overview

本研究聚焦 S1-3 的四个核心问题：

1. 应用工作台的数据组织与查询性能。  
2. 三级配额（Tenant/Group/User）检查与扣减的一致性。  
3. 阈值告警的去重和时延控制。  
4. 配额服务不可用时的降级路径。

## Decision Log

### R-001: 工作台列表查询策略

**Question**: 应用列表从哪里取数，如何保证“仅授权可见”与搜索性能？

**Options**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A. 直接查 `app` 表，再逐条校验授权 | 实现简单 | N+1 查询，性能差 | Rejected |
| B. 先算用户可访问 appId 集，再一次性回表 | 可控，易优化 | 需额外授权聚合查询 | **Selected** |

**Decision**: 采用 Option B。先由授权规则得到可访问 `appId` 集，再按条件回表查询并分页。

**Notes**:
- 搜索字段：`name`, `description`, `tags`。
- 视图切片：`recent`, `favorites`, `all`。

---

### R-002: 配额计数实现策略

**Question**: 配额检查与扣减如何兼顾性能、准确性和可恢复？

**Options**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A. 全部依赖 PostgreSQL 实时聚合 | 一致性强 | 检查延迟高 | Rejected |
| B. Redis 热计数 + PostgreSQL 账本异步落库 | 检查快，支持高并发 | 需要补偿与重放 | **Selected** |

**Decision**: 采用 Option B。  
- 检查路径读取 Redis 计数。  
- 扣减后异步写入 `quota_usage_ledger`。  
- 失败进入补偿队列并重试，保证最终一致。

---

### R-003: 多层级配额判定顺序

**Question**: Tenant/Group/User 三级配额如何判定，避免规则歧义？

**Decision**:
- 检查顺序固定为：Tenant → Group → User。  
- 任一层超限立即拒绝请求（短路）。  
- 拒绝响应返回最先触发的超限层级与剩余额度信息。

**Rationale**:
- 先保护全局预算（Tenant），再保护组织预算（Group），最后保护个人预算（User）。

---

### R-004: 告警触发与去重

**Question**: 阈值告警如何避免重复轰炸？

**Decision**:
- 每个策略每个周期每个阈值仅触发一次。  
- Redis 去重键：`quota:alert:{policyId}:{periodStart}:{threshold}`。  
- 告警事件持久化到 `quota_alert_event`，失败可重放。

---

### R-005: 降级策略实现边界

**Question**: 配额服务不可用时，S1-3 最小可用边界是什么？

**Decision**:
- 放行：应用列表与应用详情查询。  
- 拒绝：新对话/新执行请求。  
- UI：在 `/apps` 显示降级 banner，并禁用“新对话”入口。  
- 审计：记录 `gov.degradation.triggered` 事件。

**Source Alignment**:
- 对齐 `AC-S1-3-B01` 和 `docs/tech/architecture/DEGRADATION_MATRIX_P1.md`。

## Open Questions

1. 企业租户是否需要“按请求计量”与“按 token 计量”混合并存。  
2. 100% 阈值告警是否要与“超限拦截”分开发送通道。  
3. 告警 webhook 的签名与重试策略是否在 S1-3 落地，或推迟至 S3。

## Summary

- 数据路径：授权过滤 + 工作台视图分层。  
- 治理路径：Redis 热计数、PostgreSQL 账本、阈值去重告警。  
- 可用性路径：配额异常时保持浏览能力，阻断新执行。  
- 与 S1-3 验收条目（01-07, B01）一一对应，具备落地可行性。
