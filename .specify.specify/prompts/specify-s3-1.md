S3-1 管理后台核心闭环

## 切片概述

这是 Phase 1 Stage 3 的第一个切片（S3-1），依赖 S2-3（执行状态与数据持久化）。S1~S2 已建立完整的用户侧能力（认证、授权、应用目录、网关、对话、执行追踪、数据持久化）。S3-1 的目标是建立管理后台最小闭环，使 Tenant Admin 和 Manager 能够完成日常治理操作：

1. **用户管理**：列表/详情/邀请/审批/状态管理/重置密码/强制 MFA/删除
2. **群组管理**：创建/编辑/删除/成员增删/指派 Manager
3. **应用管理**：注册/编辑/启停/删除/Tags/凭证配置
4. **授权管理**：群组→应用授权/用户直授/批量/撤销/过期自动撤销
5. **配额管理**：Tenant/Group/User 三级配额配置/告警阈值
6. **Manager 能力**：团队成员管理/团队应用授权/配额查看/团队统计/群组内用户级授权

本切片完成后，管理员可进行完整的用户/群组/应用/权限/配额管理 CRUD 操作。

## 覆盖的 Feature（共 13 个）

### Tenant Admin 管理功能

- **F-ADMIN-USER-001** 用户管理：列表/搜索/详情/邀请/审批/状态变更/删除；查看用户对话须经 break-glass 审批并审计。用户列表加载 P95 ≤ 500ms（1 万用户）。
- **F-ADMIN-USER-002** 账号安全管理：重置密码（发送重置链接）/强制 MFA。
- **F-ADMIN-GROUP-001** 群组管理：创建/编辑/删除 Group；成员增删（批量 ≤ 100 人 P95 ≤ 3s）；指派/撤销 Manager。删除时成员回到 Unassigned，历史数据只读保留。
- **F-ADMIN-APP-001** 应用管理：注册（填写后端平台连接信息）/编辑/启停/删除；Tags 管理；凭证加密存储。应用注册后 ≤ 10s 可用。禁用即时生效。删除后历史对话只读保留标注"应用已删除"。
- **F-ADMIN-APP-002** 应用授权管理：应用维度查看哪些群组/用户被授权。
- **F-ADMIN-AUTHZ-001** 授权管理：群组→应用授权/撤销；用户直授（支持有效期，过期自动撤销 ≤ 1 分钟误差）；批量授权；明确拒绝。授权生效 ≤ 5s。
- **F-ADMIN-QUOTA-001** 配额管理：Tenant/Group/User 三级配额配置（Token/次数/成本上限）。配额检查每请求 ≤ 50ms。
- **F-ADMIN-QUOTA-002** 配额告警配置：阈值（80%/90%/100%）、通知方式（站内信）、告警延迟 ≤ 5 分钟。

### Manager 管理功能

- **F-MGR-001** 团队成员管理：查看/添加/移除 Group 成员（限于所管理 Group 范围）。
- **F-MGR-002** 团队应用授权管理：对所管理 Group 进行应用授权/撤销（限于 Group 范围）。
- **F-MGR-003** 团队配额使用查看：查看 Group 配额使用量（只读，不可修改上限）。
- **F-MGR-004** 团队统计报表：查看 Group 级别使用统计（成员使用排行、应用使用分布）。
- **F-MGR-005** 群组内用户级授权：Manager 在其管理的 Group 范围内进行用户级授权。

## 与前置切片的接口依赖

### 依赖 S1~S2 的能力（不重复实现）
- 用户认证/JWT/RBAC/权限判定引擎（S1-1/S1-2）
- Active Group 上下文（S1-2）
- App 实体/应用目录（S1-3）
- 配额检查/扣减服务（S1-3）
- 审计事件写入管道（S1-2 audit.service）
- Break-glass 紧急访问（S1-2 breakglass.service）
- 通知服务（S1-2 notification.service）
- 网关路由/凭证解密（S2-1）
- Conversation/Message/Run 实体（S2-2/S2-3）

### S3-1 新增的前端页面
- **Admin 用户管理页**：用户列表 + 详情 + 邀请 + 审批 + 状态管理
- **Admin 群组管理页**：群组列表 + 详情 + 成员管理 + Manager 指派
- **Admin 应用管理页**：应用列表 + 注册/编辑表单 + 凭证配置 + 启停
- **Admin 授权管理页**：群组→应用授权矩阵 + 用户直授列表
- **Admin 配额管理页**：三级配额配置 + 告警阈值设置
- **Manager 团队管理页**：Group 成员 + 授权 + 配额使用 + 统计

### S3-1 新增的 API 端点
- `GET/POST/PATCH/DELETE /api/v1/admin/users`
- `GET/POST/PATCH/DELETE /api/v1/admin/groups`
- `GET/POST/PATCH/DELETE /api/v1/admin/apps`
- `GET/POST/DELETE /api/v1/admin/authorizations`
- `GET/PATCH /api/v1/admin/quotas`
- `GET/POST /api/v1/admin/users/invite`
- `POST /api/v1/admin/users/:id/approve|reject|suspend|activate|reset-password|force-mfa`
- `GET /api/v1/manager/groups/:id/members|apps|quota|stats`

## 必须参考的文档

1. **docs/roadmap/PHASE1_BACKLOG.md** → S3-1 章节
2. **docs/prd/PRD_ADMIN.md** → 读以下章节：
   - §4 用户管理（列表/邀请/审批/状态/删除/验收标准）
   - §5 群组管理（创建/成员/Manager/删除策略）
   - §6 应用管理（注册/编辑/启停/凭证/验收标准）
   - §7 权限与授权（群组授权/直授/批量/权限合并规则）
   - §8 配额管理（三级配额/告警策略/配额到期/验收标准）
   - §9 统计与报表（Manager 团队统计维度）
3. **docs/feature-list/feature-list.json** → 读 F-ADMIN-USER-001~002、F-ADMIN-GROUP-001、F-ADMIN-APP-001~002、F-ADMIN-AUTHZ-001、F-ADMIN-QUOTA-001~002、F-MGR-001~005 共 13 个条目
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 读 User/Group/App/Grant/QuotaConfig 实体
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → S3-1 验收条目

## User Story 组织建议

- **US1（P0）用户管理**：F-ADMIN-USER-001 + F-ADMIN-USER-002 → Tenant Admin 查看用户列表（搜索/筛选/分页），邀请新用户，审批注册请求，管理用户状态（激活/暂停/解锁），重置密码，强制 MFA。
- **US2（P0）群组管理**：F-ADMIN-GROUP-001 → Tenant Admin 创建/编辑/删除 Group，批量添加/移除成员，指派/撤销 Manager；Manager 管理自己 Group 内成员（F-MGR-001）。
- **US3（P0）应用管理**：F-ADMIN-APP-001 + F-ADMIN-APP-002 → Tenant Admin 注册新 AI 应用（填写后端平台连接信息和凭证），编辑应用属性，启停应用，查看授权情况。
- **US4（P0）授权管理**：F-ADMIN-AUTHZ-001 + F-MGR-002 + F-MGR-005 → Tenant Admin 管理群组→应用授权矩阵，设置用户直授（含有效期），批量授权/撤销。Manager 在 Group 范围内进行应用和用户级授权。
- **US5（P0）配额管理**：F-ADMIN-QUOTA-001 + F-ADMIN-QUOTA-002 + F-MGR-003 → Tenant Admin 配置三级配额上限和告警阈值。Manager 查看 Group 配额使用情况（只读）。
- **US6（P1）Manager 团队统计**：F-MGR-004 → Manager 查看 Group 级成员使用排行和应用使用分布统计。

## Edge Cases 提示

- **删除最后一个 Tenant Admin**：拒绝操作，至少保留 1 个 Tenant Admin
- **删除用户的数据保留**：30 天冷静期，期间可恢复；过期后 PII 脱敏，对话/执行记录匿名保留
- **群组删除后的成员归属**：自动归入 Unassigned，对话记录标记"群组已删除"
- **应用凭证更新**：更新 API Key 后，已有会话使用新凭证（下次请求生效）
- **授权直授过期**：定时任务准时撤销（误差 ≤ 1 分钟），撤销时刻正在进行的会话可完成但不可发起新消息
- **配额上限冲突**：User 配额不可超过 Group 配额，Group 配额不可超过 Tenant 配额 → 保存时校验
- **并发审批**：两个 Admin 同时审批同一用户 → 乐观锁，第二个操作失败提示
- **Manager 权限边界**：Manager 只能看到和操作自己管理的 Group，不能跨 Group 操作
- **批量操作失败**：批量添加 100 人中 5 人邮箱已存在 → 成功 95 人 + 返回失败列表

## 边界约束

- ❌ 不涉及 ROOT ADMIN 平台管理（属于 S3-3）
- ❌ 不涉及审计日志查询/导出 UI（属于 S3-2）
- ❌ 不涉及安全合规策略配置 UI（属于 S3-2）
- ❌ 不涉及系统设置（品牌/多语言/Webhook 等，属于 S3-3）
- ❌ 不涉及统计报表（Tenant Admin 级，属于 S3-2）
- ❌ 不实现权限判定引擎（复用 S1-2）
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
