请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

以下澄清点基于对 docs/prd/PRD.md §4、docs/tech/data-model/DOMAIN_MODEL_P1.md §3.3~3.4、docs/feature-list/feature-list.json F-IAM-001~008、specs/1-multi-tenant-auth/spec.md 的完整阅读得出。

---

## 一、角色与权限模型（高影响）

### Q1. Manager 角色的双重身份
**问题**：S1-1 的 GroupMember 表已有 role 字段（member/manager），S1-2 又引入了 Role 表。Manager 到底是 Role 表里的一个角色，还是仅通过 GroupMember.role 判定？两者什么关系？
**答案**：**Manager 不是 Role 表中的独立角色，而是通过 GroupMember.role='manager' 判定**。Role 表预置角色只有 3 个：root_admin、tenant_admin、user。Manager 是 Group 级别的"角色绑定"（PRD §4.2.1："管理角色绑定，非独立实体"），不是 RBAC 角色。权限判定时，系统先查 UserRole 获取 RBAC 角色，再查 GroupMember.role 判定当前用户在目标 Group 是否为 Manager。
**Spec 更新**：在 Key Entities 中明确"Manager 不是 Role 表实体，而是 GroupMember.role 的值"。在 US1 中说明 RBAC 角色（3个）与 Group 级角色（member/manager）的关系。

### Q2. ROOT ADMIN 启用机制
**问题**：F-IAM-001 说"ROOT ADMIN 默认关闭，需显式启用"。具体如何启用？
**答案**：**通过环境变量或部署配置启用**，不通过 UI。v1.0 中 ROOT ADMIN 的启用是运维级操作：(1) 设置环境变量 `ENABLE_ROOT_ADMIN=true`，(2) 通过种子数据或 CLI 创建第一个 ROOT ADMIN 用户。这是安全设计，避免通过 UI 意外暴露平台级权限。
**Spec 更新**：补充 FR "系统 MUST 仅在环境变量 ENABLE_ROOT_ADMIN=true 时启用 ROOT ADMIN 功能"。在 Assumptions 中说明"ROOT ADMIN 的创建是部署级操作，不在 UI 范围"。

### Q3. 权限代码预置集的完整范围
**问题**：Domain Model 列出了 8 个示例权限代码（tenant:manage、group:create 等），S1-2 需要实现完整的权限代码集还是仅这些？
**答案**：**S1-2 实现 S1-2 范围内需要的核心权限代码**，不需要一次性预置所有可能的权限。核心集合为：
- `tenant:manage` - 租户设置管理
- `tenant:view_audit` - 查看审计日志
- `group:create` - 创建群组
- `group:manage` - 管理群组成员
- `app:register` - 注册应用（S1-3 使用，S1-2 预置）
- `app:grant` - 授权应用访问
- `app:use` - 使用应用
- `conversation:view_others` - 查看他人对话（需事由+审计）
- `conversation:export` - 导出对话
后续切片可新增权限代码，权限系统设计为可扩展。
**Spec 更新**：在 Key Entities 的 Permission 中列出 S1-2 的核心权限代码集。

### Q4. 显式拒绝（Deny）由谁创建
**问题**：F-IAM-005 描述了 Deny 优先规则，但谁可以创建 Deny 记录？
**答案**：**仅 Tenant Admin 可创建 Deny**。通过 AppGrant 表的 permission='deny' 实现。Deny 的 granteeType 可以是 user（拒绝特定用户）或 group（拒绝特定群组）。Deny 无有效期限制，需手动撤销。Deny 的创建和撤销都纳入审计。
**Spec 更新**：补充 FR "系统 MUST 仅允许 Tenant Admin 创建和撤销显式拒绝（Deny）记录"。补充 FR "Deny 记录无自动过期机制，需手动撤销"。

---

## 二、授权判定与缓存（高影响）

### Q5. 权限判定 ≤50ms 的实现策略
**问题**：50ms 的性能要求是否意味着需要权限缓存？缓存失效策略是什么？
**答案**：**这是 Spec 层面的性能要求，不指定实现方式（那是 plan 的事）**。但 Spec 应明确：(1) 权限判定 P95 ≤50ms 是硬性指标，(2) 权限变更后 ≤5s 全平台生效（AC-S1-2-B02），这两个要求之间的关系由实现层面解决（可能是短 TTL 缓存或事件驱动失效）。
**Spec 更新**：确认 SC 同时包含 "权限判定 P95 ≤50ms" 和 "权限变更 ≤5s 全平台生效" 两个指标，不在 Spec 中指定缓存策略。

### Q6. 权限判定的输入输出接口
**问题**：权限判定的调用方式是什么？是每次 API 请求都判定还是登录时一次性计算？
**答案**：**每次 API 请求都实时判定**。输入：(userId, tenantId, activeGroupId, resourceType, action)。输出：(allowed: boolean, reason: string, matchedGrant?: AppGrant)。权限判定是中间件/拦截器模式，拦截所有业务请求。这不是指定实现方式，而是明确权限判定的行为语义。
**Spec 更新**：补充 FR "系统 MUST 在每次业务请求时实时判定权限，不依赖登录时一次性计算"。

---

## 三、智能上下文切换（高影响）

### Q7. 多 Tenant + 多 Group 场景下的 Active Group 默认值
**问题**：用户属于多个 Tenant，每个 Tenant 下属于多个 Group。切换 Tenant 后，Active Group 默认取什么值？
**答案**：**切换 Tenant 后，Active Group 取该 Tenant 下用户上次使用的 Group（本地持久化）**。如果是首次进入某 Tenant（无历史记录），则默认选择该 Tenant 下的 Default Group（S1-1 已确立每个 Tenant 有一个 Default Group）。本地持久化格式为 `{tenantId: lastActiveGroupId}` 的 Map。
**Spec 更新**：补充 FR "系统 MUST 按 Tenant 维度持久化用户上次使用的 Active Group"。补充 FR "首次进入 Tenant 时默认 Active Group 为 Default Group"。

### Q8. Group Switcher 仅展示有权群组
**问题**：Group Switcher 展示用户所有所属群组，还是仅展示对当前应用有授权的群组？
**答案**：**仅展示对当前应用有授权的群组**（PRD §4.2.4a："用户仅可选择其所属且被授权访问当前应用的群组"）。如果用户属于 3 个群组但只有 2 个群组授权了当前应用，Switcher 只展示这 2 个。如果不在应用上下文（如在工作台首页），则展示用户所有所属群组。
**Spec 更新**：补充 FR "Group Switcher 在应用上下文中仅展示对当前应用有授权的群组"。补充 FR "Group Switcher 在非应用上下文中展示用户所有所属群组"。

---

## 四、Manager 用户级授权（中影响）

### Q9. Manager 用户级授权与 Tenant Admin 用户直授的区别
**问题**：PRD §4.2.3 描述了 3 种授权来源：群组→应用（Tenant Admin）、用户直授（Tenant Admin）、Manager 群组内用户级授权。第 3 种在 S1-2 范围吗？
**答案**：**S1-2 建立数据模型支持，但 Manager 用户级授权的完整管理 UI 在 S3-1（F-MGR-005）**。具体来说：
- S1-2 实现：AppGrant 表已支持 granteeType=user，权限判定引擎已支持"群组授权 / Manager 用户级授权同级"的优先级规则。
- S3-1 实现：Manager 在管理界面中为群组成员分配应用访问权限的 UI 和 API。
- 关键区别：Manager 用户级授权依托群组授权范围（不可新增 Tenant 级授权），可选填原因，无有效期限制（跟随群组授权生命周期）。
**Spec 更新**：在 FR 中补充"权限判定引擎 MUST 支持 Manager 用户级授权作为与群组授权同优先级的授权来源"。在边界约束中明确"Manager 用户级授权的管理 UI 和 API 属于 S3-1"。

---

## 五、Break-glass 紧急访问（中影响）

### Q10. Break-glass 的站内信通知
**问题**：F-IAM-002 要求 Break-glass 时"自动向 Tenant Admin 发送站内信通知"。站内信系统在 S1-2 范围吗？
**答案**：**S1-2 实现最小通知能力，不实现完整的站内信系统**。Break-glass 触发时：(1) 创建 Critical 审计记录，(2) 在 Tenant Admin 的管理后台显示未读通知标记（红点/数字），(3) 通知内容包含：谁触发了 Break-glass、事由、时间、影响范围。完整的站内信收件箱、历史、已读/未读管理属于 S3 范围。
**Spec 更新**：补充 FR "系统 MUST 在 Break-glass 触发时创建面向 Tenant Admin 的通知记录"。在 Assumptions 中说明"完整站内信系统不在 S1-2 范围"。

### Q11. Break-glass 访问范围
**问题**：ROOT ADMIN 通过 Break-glass 可以访问什么？所有 Tenant 数据？还是需指定 Tenant？
**答案**：**需指定目标 Tenant**。Break-glass 不是"全局通行证"，而是"定向紧急访问"。ROOT ADMIN 触发时必须选择目标 Tenant，获得的权限等同于该 Tenant 的 Tenant Admin（但有审计和时限约束）。一次 Break-glass 只能访问一个 Tenant。
**Spec 更新**：补充 FR "Break-glass MUST 要求指定目标 Tenant，不可跨 Tenant 通行"。补充 Acceptance Scenario "ROOT ADMIN 触发 Break-glass 并选择 Tenant A → 获得 Tenant A 的 Tenant Admin 权限 → 1 小时后自动失效"。

---

## 六、数据模型与切片边界（中影响）

### Q12. App 实体在 S1-2 的最小定义
**问题**：S1-2 需要 App 实体来建立 AppGrant 关联，但完整的 App 管理在 S1-3。S1-2 需要 App 表的哪些字段？
**答案**：**S1-2 需要 App 的最小结构**：id、tenantId、name、status。其他字段（externalId、externalPlatform、mode、icon、config 等）在 S1-3 补充。S1-2 可通过种子数据创建测试用 App，用于验证 AppGrant 授权流程。
**Spec 更新**：在 Key Entities 中标注 App 实体"S1-2 仅需最小字段集（id/tenantId/name/status），完整定义见 S1-3"。

### Q13. 授权变更的审计复用 S1-1 基础设施
**问题**：S1-2 的授权变更需要审计记录，是否复用 S1-1 已建立的 AuditEvent 基础设施？
**答案**：**是，复用 S1-1 的 AuditEvent 表和写入机制**。S1-2 新增的审计事件类型包括：
- `grant.created` - 授权创建（群组→应用 或 用户直授）
- `grant.revoked` - 授权撤销
- `grant.expired` - 授权过期自动失效
- `deny.created` - 显式拒绝创建
- `deny.revoked` - 显式拒绝撤销
- `breakglass.activated` - Break-glass 触发（Severity=Critical）
- `breakglass.expired` - Break-glass 过期
- `role.assigned` - 角色分配
- `role.removed` - 角色移除
**Spec 更新**：补充 FR "系统 MUST 记录所有授权变更事件到审计日志，复用 S1-1 的 AuditEvent 基础设施"。列出新增审计事件类型。

---

## 七、安全边界（低影响）

### Q14. 最后一个 Tenant Admin 保护
**问题**：如果 Tenant Admin 把自己降级为 User，且是最后一个 Admin，会导致 Tenant 无人管理。
**答案**：**系统必须阻止最后一个 Tenant Admin 的角色降级或删除**。规则：(1) 每个 Tenant 至少保留一个 Tenant Admin，(2) 降级操作前检查当前 Tenant 的 Tenant Admin 数量，(3) 如果是最后一个，拒绝操作并提示"请先指定另一个 Tenant Admin"。
**Spec 更新**：补充 FR "系统 MUST 阻止 Tenant 下最后一个 Tenant Admin 的角色降级或删除"。补充 Edge Case。

### Q15. UserRole.expiresAt 的使用场景
**问题**：UserRole 表有 expiresAt 字段，除了 Break-glass 场景外还有什么用途？
**答案**：**主要用于 Break-glass 和临时角色提升**。当前 S1-2 的使用场景：(1) Break-glass 临时 Tenant Admin 权限（1 小时过期），(2) 未来可扩展用于临时角色分配（如临时 Manager）。v1.0 仅 Break-glass 使用此字段。系统需要定期检查并清理过期的 UserRole 记录。
**Spec 更新**：补充 FR "系统 MUST 定期检查并自动清理过期的 UserRole 和 AppGrant 记录"。
