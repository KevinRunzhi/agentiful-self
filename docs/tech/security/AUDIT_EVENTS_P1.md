# AgentifUI 审计事件 v0

* **规范版本**：v0.1
* **最后更新**：2026-01-26
* **状态**：草稿，待评审
* **参考**：PRD 第 8.4-8.5 节 + Dify 事件设计

---

## 1. 概述

本文档定义 AgentifUI 审计事件的最小枚举与字段模型，确保关键安全与治理事件可追溯。

### 设计原则

1. **不可篡改**：审计日志产品层不可编辑、不可删除
2. **最小必要**：仅记录安全和治理相关的关键事件
3. **结构化**：统一字段模型，便于查询和分析
4. **可追溯**：关联 Trace ID，支持端到端追踪

---

## 2. 事件分类

### 2.1 类别总览

| 类别 | 代码前缀 | 描述 | 可关闭 |
|------|----------|------|--------|
| 认证事件 | `auth.*` | 登录、登出、Token 操作 | ❌ |
| 权限变更 | `authz.*` | 角色、授权、策略变更 | ❌ |
| 高风险访问 | `access.*` | 敏感数据访问 | ❌ |
| 治理安全 | `gov.*` | 拦截、脱敏、告警 | ❌ |
| 管理操作 | `admin.*` | 租户、应用、用户管理 | ❌ |
| 业务操作 | `biz.*` | 对话、执行等业务事件 | ⚠️ 可配置 |

---

## 3. 事件枚举

### 3.1 认证事件 (auth.*)

| 事件代码 | 描述 | 触发时机 |
|----------|------|----------|
| `auth.login.success` | 登录成功 | 用户登录成功 |
| `auth.login.failure` | 登录失败 | 密码错误、账户锁定等 |
| `auth.logout` | 登出 | 用户主动登出 |
| `auth.sso.success` | SSO 登录成功 | SSO 认证成功 |
| `auth.sso.failure` | SSO 登录失败 | SSO 认证失败 |
| `auth.mfa.enabled` | MFA 启用 | 用户启用 MFA |
| `auth.mfa.disabled` | MFA 禁用 | 用户禁用 MFA |
| `auth.token.issued` | Token 发放 | 签发新 Token |
| `auth.token.refreshed` | Token 刷新 | 刷新 Token |
| `auth.token.revoked` | Token 撤销 | Token 被撤销 |
| `auth.password.changed` | 密码修改 | 用户修改密码 |
| `auth.password.reset` | 密码重置 | 密码重置完成 |

---

### 3.2 权限变更 (authz.*)

| 事件代码 | 描述 | 触发时机 |
|----------|------|----------|
| `authz.role.assigned` | 角色分配 | 用户被分配角色 |
| `authz.role.revoked` | 角色撤销 | 用户角色被撤销 |
| `authz.group.member.added` | 成员加入群组 | 用户加入群组 |
| `authz.group.member.removed` | 成员移出群组 | 用户被移出群组 |
| `authz.group.member.role.changed` | 群组角色变更 | 成员角色变更（如升为 Manager） |
| `authz.app.granted` | 应用授权 | 应用授权给群组/用户 |
| `authz.app.revoked` | 应用撤权 | 应用授权被撤销 |
| `authz.quota.updated` | 配额更新 | 配额设置变更 |
| `authz.policy.updated` | 策略更新 | 合规策略变更 |

---

### 3.3 高风险访问 (access.*)

| 事件代码 | 描述 | 触发时机 |
|----------|------|----------|
| `access.conversation.viewed` | 查看他人对话 | Tenant Admin 查看用户对话 |
| `access.conversation.exported` | 导出对话 | 导出对话内容 |
| `access.audit.exported` | 导出审计日志 | 导出审计记录 |
| `access.breakglass` | Break-glass 操作 | ROOT ADMIN 紧急访问租户 |

> [!IMPORTANT]
> `access.*` 事件必须记录 `reason` 字段，说明访问事由。

---

### 3.4 治理安全 (gov.*)

| 事件代码 | 描述 | 触发时机 |
|----------|------|----------|
| `gov.pii.detected` | PII 检测 | 检测到敏感信息 |
| `gov.pii.masked` | PII 脱敏 | 敏感信息被脱敏 |
| `gov.injection.detected` | 注入检测 | 检测到提示词注入 |
| `gov.content.blocked` | 内容拦截 | 内容被合规拦截 |
| `gov.quota.warning` | 配额告警 | 配额使用达到阈值 |
| `gov.quota.exceeded` | 配额超限 | 配额已用尽 |
| `gov.ratelimit.triggered` | 限流触发 | 请求被限流 |

---

### 3.5 管理操作 (admin.*)

| 事件代码 | 描述 | 触发时机 |
|----------|------|----------|
| `admin.tenant.created` | 租户创建 | 创建新租户 |
| `admin.tenant.updated` | 租户更新 | 更新租户配置 |
| `admin.tenant.archived` | 租户归档 | 租户被归档 |
| `admin.user.created` | 用户创建 | 创建新用户 |
| `admin.user.updated` | 用户更新 | 更新用户信息 |
| `admin.user.banned` | 用户封禁 | 用户被封禁 |
| `admin.user.deleted` | 用户删除 | 用户被删除 |
| `admin.group.created` | 群组创建 | 创建新群组 |
| `admin.group.updated` | 群组更新 | 更新群组信息 |
| `admin.group.deleted` | 群组删除 | 删除群组 |
| `admin.app.registered` | 应用注册 | 注册新应用 |
| `admin.app.updated` | 应用更新 | 更新应用配置 |
| `admin.app.disabled` | 应用禁用 | 应用被禁用 |
| `admin.app.deleted` | 应用删除 | 应用被删除 |

---

### 3.6 业务操作 (biz.*)

| 事件代码 | 描述 | 触发时机 | 默认开启 |
|----------|------|----------|----------|
| `biz.conversation.created` | 会话创建 | 用户创建新会话 | ✅ |
| `biz.conversation.deleted` | 会话删除 | 用户删除会话 | ✅ |
| `biz.message.sent` | 消息发送 | 用户发送消息 | ❌ |
| `biz.run.started` | 执行开始 | 工作流/Agent 执行开始 | ✅ |
| `biz.run.completed` | 执行完成 | 执行正常完成 | ✅ |
| `biz.run.failed` | 执行失败 | 执行失败 | ✅ |
| `biz.run.stopped` | 执行停止 | 用户停止执行 | ✅ |
| `biz.share.created` | 分享创建 | 创建对话分享链接 | ✅ |
| `biz.share.revoked` | 分享撤销 | 撤销分享链接 | ✅ |

---

## 4. 字段模型

### 4.1 通用字段

所有审计事件包含以下字段：

```typescript
interface AuditEvent {
  // 标识
  id: string;                              // 事件 ID (UUID)
  tenant_id: string;                       // 租户 ID
  trace_id?: string;                       // Trace ID
  
  // 操作者
  actor_id: string;                        // 操作者 ID
  actor_type: 'user' | 'system' | 'api';   // 操作者类型
  actor_name?: string;                     // 操作者名称（快照）
  
  // 事件
  action: string;                          // 事件代码
  resource_type: string;                   // 资源类型
  resource_id?: string;                    // 资源 ID
  resource_name?: string;                  // 资源名称（快照）
  
  // 结果
  result: 'success' | 'failure' | 'denied';
  reason?: string;                         // 操作事由（高风险必填）
  error_message?: string;                  // 失败原因
  
  // 上下文
  metadata?: Record<string, any>;          // 附加数据
  ip?: string;                             // 来源 IP
  user_agent?: string;                     // User Agent
  
  // 时间
  created_at: string;                      // ISO 8601 时间戳
}
```

### 4.2 资源类型

| resource_type | 说明 |
|---------------|------|
| `tenant` | 租户 |
| `user` | 用户 |
| `group` | 群组 |
| `app` | 应用 |
| `conversation` | 会话 |
| `message` | 消息 |
| `run` | 执行记录 |
| `file` | 文件 |
| `token` | Token |
| `role` | 角色 |
| `permission` | 权限 |
| `policy` | 策略 |
| `quota` | 配额 |
| `share` | 分享链接 |

---

## 5. 保留策略

| 配置项 | 默认值 | 可配置范围 | 说明 |
|--------|--------|------------|------|
| 保留期 | 180 天 | 180 天 ~ 7 年 | Tenant 级配置 |
| 法务最短期 | 180 天 | - | 即使租户删除也保留 |

---

## 6. 查询接口

### `GET /v1/admin/audit-events`

**权限要求**：`Tenant Admin` 或 `audit.read` 权限

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| action | string | 按事件代码筛选 |
| actor_id | string | 按操作者筛选 |
| resource_type | string | 按资源类型筛选 |
| resource_id | string | 按资源 ID 筛选 |
| result | string | 按结果筛选 |
| start_time | string | 开始时间 (ISO 8601) |
| end_time | string | 结束时间 (ISO 8601) |
| limit | number | 返回数量，默认 50 |
| cursor | string | 分页游标 |

**响应**：

```typescript
interface AuditEventsResponse {
  object: 'list';
  data: AuditEvent[];
  has_more: boolean;
  next_cursor?: string;
}
```

---

## 7. 示例事件

### 7.1 登录成功

```json
{
  "id": "evt_abc123",
  "tenant_id": "ten_xyz789",
  "actor_id": "usr_def456",
  "actor_type": "user",
  "actor_name": "张三",
  "action": "auth.login.success",
  "resource_type": "user",
  "resource_id": "usr_def456",
  "result": "success",
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-01-26T12:00:00Z"
}
```

### 7.2 查看他人对话

```json
{
  "id": "evt_abc456",
  "tenant_id": "ten_xyz789",
  "trace_id": "tr_abc123xyz",
  "actor_id": "usr_admin001",
  "actor_type": "user",
  "actor_name": "管理员",
  "action": "access.conversation.viewed",
  "resource_type": "conversation",
  "resource_id": "conv_user123",
  "resource_name": "用户对话-项目讨论",
  "result": "success",
  "reason": "用户投诉内容审核",
  "metadata": {
    "target_user_id": "usr_user123",
    "target_user_name": "李四"
  },
  "ip": "10.0.0.1",
  "created_at": "2026-01-26T14:30:00Z"
}
```

---

## 8. 与 PRD 对应关系

| PRD 要求 | 本规范覆盖 |
|----------|------------|
| 鉴权事件 | `auth.*` |
| 权限变更 | `authz.*` |
| 高风险访问 | `access.*` |
| 治理安全 | `gov.*` |
| 管理后台 | `admin.*` |
| 通用字段 | 第 4 节 |
| 保留期 | 第 5 节 |

---

## 附录 A：相关文档

- [PRD 第 8 章 - 安全与合规](../../prd/PRD.md#8-安全与合规)
- [核心领域模型 v0](../data-model/DOMAIN_MODEL_P1.md)
- [网关契约 v0](../api-contracts/GATEWAY_CONTRACT_P1.md)
