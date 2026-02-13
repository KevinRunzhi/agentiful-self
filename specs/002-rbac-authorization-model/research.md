# Research: RBAC Authorization Model (S1-2)

**Feature**: 002-rbac-authorization-model
**Created**: 2025-02-11
**Status**: Complete

## Overview

本文档记录 S1-2 切片（RBAC 授权模型）的技术调研结果，包括权限判定引擎设计、多群组权限合并策略、Break-glass 实现方案等关键技术决策。

---

## 1. 权限判定引擎设计

### Decision: 基于优先级链的实时判定引擎

**架构选择**：
- **实时判定**：每次 API 请求时执行权限检查，不依赖登录时一次性计算
- **优先级链**：Deny > 用户直授 Allow > 群组授权/Manager用户级授权 Allow（同级）> 默认拒绝
- **输入接口**：`(userId, tenantId, activeGroupId, resourceType, action)`
- **输出接口**：`(allowed: boolean, reason: string, matchedGrant?: AppGrant)`

**性能要求**：
- P95 响应时间 ≤ 50ms
- 权限变更 ≤ 5s 全平台生效

**实现策略**：
- Redis 缓存用户权限计算结果（TTL 5s）
- 权限变更时主动失效缓存（Pub/Sub）
- 数据库查询优化：单次查询获取所有相关授权记录

**Rationale**：
- 实时判定确保权限变更即时生效，满足 ≤5s 全平台生效要求
- Redis 缓存平衡性能与一致性，5s TTL 与生效时间要求匹配
- 优先级链设计清晰，易于扩展和维护

**Alternatives Considered**：
- **登录时一次性计算**：无法满足权限变更即时生效要求
- **纯数据库查询**：性能无法满足 50ms P95 要求
- **更长 TTL 缓存**：权限变更生效时间超过 5s，违反 Spec

---

## 2. 多群组权限合并策略

### Decision: 访问权限并集（OR），配额归因到当前工作群组

**合并规则**：
- 访问权限：任一群组授予 Allow 即可访问（OR 逻辑）
- 显式拒绝：Deny 优先级最高，一个群组 Deny 即拒绝
- 配额归因：扣费归因到用户选择的 Active Group

**Active Group 选择机制**：
1. 默认上次使用的群组（本地持久化）
2. 顶部导航 Group Switcher 手动切换
3. API Header `X-Active-Group-ID` 指定
4. 多 Tenant 场景：按 Tenant 维度持久化 `{tenantId: lastActiveGroupId}`

**Group Switcher 展示规则**：
- 应用上下文：仅展示已授权当前应用的群组
- 非应用上下文：展示用户所有所属群组
- 单群组用户：隐藏 Switcher

**Rationale**：
- 并集合并符合最小权限原则的相反意图（最小授权 vs 最大便利）
- 配额归因到 Active Group 支持成本追踪和分群组配额管理
- Switcher 智能展示减少用户认知负担

**Alternatives Considered**：
- **交集（AND）合并**：过于严格，跨群组协作场景不可用
- **配额平分到所有群组**：无法准确追踪使用成本
- **配额归因到所有群组**：配额计算复杂，容易超限

---

## 3. Break-glass 紧急访问机制

### Decision: 基于临时角色提升 + Critical 审计记录

**实现方案**：
1. **启用方式**：环境变量 `ENABLE_ROOT_ADMIN=true`（运维级操作）
2. **访问流程**：ROOT ADMIN 填写事由 → 指定目标 Tenant → 获得临时 Tenant Admin 权限
3. **权限限制**：1 小时或会话有效，不可跨 Tenant 通行
4. **审计要求**：Severity=Critical，不可删除，包含事由、时间、目标 Tenant

**数据模型**：
- `UserRole.expiresAt` 记录过期时间（1 小时）
- 临时角色创建时设置 `roleId=Tenant_Admin`, `tenantId=目标Tenant`

**通知机制**：
- S1-2 实现：在 Tenant Admin 管理后台显示未读通知标记
- S3 扩展：完整站内信系统（收件箱、历史、已读/未读管理）

**Rationale**：
- 环境变量启用避免意外暴露平台级权限
- 指定 Tenant 确保访问范围可控，符合最小权限原则
- Critical 审计记录确保可追溯性
- 通知机制让 Tenant Admin 知晓紧急访问事件

**Alternatives Considered**：
- **全局通行证**：安全风险过大，违反最小权限原则
- **UI 启用开关**：容易被误操作或滥用
- **无需通知**：Tenant Admin 无法感知异常访问

---

## 4. Manager 角色模型

### Decision: Manager 不是 Role 表实体，而是 GroupMember.role 的值

**数据模型**：
- `Role` 表预置角色：`root_admin`, `tenant_admin`, `user`（3 个）
- `GroupMember.role` 字段：`member` / `manager`（Group 级角色绑定）
- 权限判定流程：先查 `UserRole` 获取 RBAC 角色 → 再查 `GroupMember.role` 判定 Manager 身份

**权限边界**：
- Manager 权限仅在其被绑定的群组内生效
- 跨群组操作被拒绝
- Manager 可查看当前 Group 统计（仅指标），不可查看成员对话内容

**S1-2 vs S3-1 职责划分**：
- S1-2：建立 `AppGrant.granteeType=user` 数据模型支持
- S3-1：实现 Manager 用户级授权的完整管理 UI

**Rationale**：
- Manager 是 Group 级别的"角色绑定"，不是全局 RBAC 角色
- 通过 `GroupMember.role` 判定简化模型，避免冗余数据
- 职责划分清晰，S1-2 专注核心引擎，S3-1 完善管理体验

**Alternatives Considered**：
- **Manager 作为 Role 表实体**：模型冗余，Manager 身份与 Group 解耦
- **S1-2 实现 Manager UI**：切片过大，违反 MVP 优先原则

---

## 5. 权限变更即时生效策略

### Decision: Redis 缓存 + Pub/Sub 主动失效

**实现方案**：
1. **缓存结构**：`perm:{userId}:{tenantId}` → 权限计算结果
2. **TTL 策略**：5 秒自动过期（兜底机制）
3. **主动失效**：授权变更时 Pub `perm:invalidate:{userId}`，所有节点订阅并删除缓存
4. **一致性保证**：写后失效，确保下次请求获取最新权限

**性能指标**：
- 缓存命中：响应时间 < 10ms
- 缓存未命中：响应时间 < 50ms（数据库查询）
- 全平台生效时间：≤ 5s

**Rationale**：
- Redis Pub/Sub 实现跨节点缓存失效，满足全平台生效要求
- 5s TTL 作为兜底，避免 Pub/Sub 消息丢失导致权限不一致
- 写后失效策略保证一致性，避免脏读

**Alternatives Considered**：
- **纯数据库查询**：无法满足 50ms P95 性能要求
- **长 TTL 缓存**：权限变更生效时间超过 5s
- **定期刷新**：资源浪费，无法保证即时生效

---

## 6. 显式拒绝（Deny）实现

### Decision: AppGrant.permission='deny'，仅 Tenant Admin 可创建

**数据模型**：
- `AppGrant.permission` 枚举：`use` / `deny`
- `AppGrant.expiresAt`：Deny 记录无自动过期（NULL 表示永久）
- 创建权限：仅 Tenant Admin

**优先级处理**：
- Deny 优先级最高，覆盖所有 Allow 授权
- 判定逻辑：存在任一 Deny 即拒绝（不考虑 Active Group）

**撤销机制**：
- 手动撤销（Tenant Admin 操作）
- 无自动过期（需明确操作撤销）

**Rationale**：
- 显式拒绝是安全边界，必须由 Tenant Admin 明确操作
- 无自动过期避免安全策略意外失效
- 最高优先级确保 Deny 不会被 Allow 覆盖

**Alternatives Considered**：
- **Deny 支持自动过期**：安全策略意外失效风险
- **Manager 可创建 Deny**：权限过大，违反职责分离原则

---

## 7. ABAC 附加条件设计

### Decision: ABAC 作为 Allow/Deny 附加条件，不单独产生授权

**实现方案**：
- 基础授权：RBAC（角色）+ AppGrant（授权）
- 附加条件：时间窗口、IP 限制、设备信任等
- 判定逻辑：先判定基础授权，再校验 ABAC 条件

**ABAC 场景（v2.0+ 扩展）**：
- 时间窗口：仅工作日 9-18 可访问敏感资源
- IP 限制：管理操作仅限内网 IP
- 设备信任：新设备需 MFA 验证

**Rationale**：
- ABAC 作为增强，不破坏 RBAC 核心模型
- 附加条件可渐进式添加，降低复杂度
- v1.0 聚焦核心 RBAC，ABAC 作为扩展点

**Alternatives Considered**：
- **ABAC 作为独立授权源**：模型复杂度过高
- **v1.0 完整 ABAC**：违反 MVP 优先原则

---

## 8. 过期记录清理策略

### Decision: 定时任务 + 软删除标记

**清理范围**：
- `UserRole.expiresAt < NOW()`：过期角色绑定
- `AppGrant.expiresAt < NOW()`：过期授权记录

**清理策略**：
1. **定时任务**：BullMQ Repeat Jobs，每日凌晨 2 点执行
2. **软删除**：标记 `deletedAt` 而非物理删除（审计追溯）
3. **批量处理**：每批 1000 条，避免长事务

**Rationale**：
- 定时任务清理避免过期数据累积
- 软删除保留审计追溯能力
- 批量处理避免数据库压力

**Alternatives Considered**：
- **实时清理**：性能开销过大
- **物理删除**：无法追溯历史授权

---

## 9. API 契约设计参考

### Decision: RESTful API + OpenAPI 3.1 规范

**设计原则**：
- 资源导向：`/grants`, `/roles`, `/permissions`
- HTTP 方法语义：GET（查询）、POST（创建）、PATCH（更新）、DELETE（删除）
- 统一响应格式：`{ data, meta, errors }`
- 错误码前缀：`AFUI_IAM_xxx`

**关键端点**：
- `POST /grants`：创建授权（Tenant Admin）
- `DELETE /grants/{id}`：撤销授权
- `GET /permissions/check`：权限判定查询
- `POST /breakglass/activate`：激活紧急访问

**Rationale**：
- RESTful 风格符合行业标准，易于理解和维护
- OpenAPI 规范支持自动生成客户端 SDK
- 统一错误码便于问题排查

---

## 10. 前端状态管理设计

### Decision: Zustand + TanStack Query

**状态分层**：
- **服务端状态**（TanStack Query）：权限数据、授权列表、角色列表
- **客户端状态**（Zustand）：Active Group、Break-glass 会话状态

**Active Group 管理**：
- Zustand store: `useAuthStore`
- 本地持久化：`{tenantId: lastActiveGroupId}` → localStorage
- 跨 Tab 同步：BroadcastChannel API

**Rationale**：
- TanStack Query 自动处理缓存、重试、乐观更新
- Zustand 轻量无样板代码
- 本地持久化确保刷新后恢复状态

---

## 总结

| 技术决策 | 关键方案 | 性能/安全要求 |
|----------|----------|---------------|
| 权限判定引擎 | Redis 缓存 + Pub/Sub 失效 | P95 ≤ 50ms，≤ 5s 生效 |
| 多群组权限 | 访问并集，配额归因 Active Group | 100% 正确性 |
| Break-glass | 临时角色提升 + Critical 审计 | 1 小时自动失效 |
| Manager 模型 | GroupMember.role 判定 | 跨群组访问拦截 |
| Deny 实现 | AppGrant.permission='deny' | 最高优先级 |
| ABAC | 作为附加条件 | v2.0+ 扩展 |
| 过期清理 | 定时任务 + 软删除 | 每日清理 |

---

*本文档基于 .specify/templates/plan-template.md 生成*
