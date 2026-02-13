# Feature Specification: RBAC Authorization Model (S1-2)

**Feature Branch**: `002-rbac-authorization-model`
**Created**: 2025-02-11
**Status**: Draft
**Input**: S1-2 RBAC 与授权模型
**Constitution Check**: 符合 `.specify.specify/memory/constitution.md` 原则

## Clarifications

### Session 2025-02-11 (Initial)

基于 PRD.md §4、DOMAIN_MODEL_P1.md、PHASE1_BACKLOG.md 和 feature-list.json 的澄清：

- **Q: ROOT ADMIN 默认状态？** → A: ROOT ADMIN 默认关闭，需显式配置启用。作用域为 Platform，用于租户生命周期管理和运维排障。
- **Q: Manager 用户级授权与用户直授的区别？** → A: Manager 用户级授权依托群组授权范围，无有效期限制（跟随群组生命周期），可选填写原因；用户直授可绕过群组结构，需原因+有效期（默认7天，最长90天），仅 Tenant Admin 可执行。
- **Q: 权限判定优先级？** → A: Deny（显式拒绝）> 用户直授 Allow > 群组授权/Manager用户级授权 Allow（同级）> 默认拒绝。ABAC 仅作为 Allow/Deny 附加条件，不单独产生授权。
- **Q: 多群组权限合并规则？** → A: 访问权限按并集（OR）合并，任一群组授予即可访问。配额/扣费归因到当前工作群组，扣费群组必须是授予该 App 访问权的群组之一。
- **Q: Manager 可见性边界？** → A: Manager 可查看团队统计、趋势与用户级指标排行（仅指标，不含内容），数据范围严格限制为当前 Group 上下文产生的数据，不可查看成员对话内容/摘要，不可聚合展示用户跨组或个人空间行为数据。

### Session 2025-02-11 (Detailed)

基于 clarify-s1-2.md 的完整澄清：

- **Q: Manager 角色的双重身份？** → A: Manager 不是 Role 表中的独立角色，而是通过 GroupMember.role='manager' 判定。Role 表预置角色只有 3 个：root_admin、tenant_admin、user。Manager 是 Group 级别的"角色绑定"，不是 RBAC 角色。权限判定时先查 UserRole 获取 RBAC 角色，再查 GroupMember.role 判定当前用户在目标 Group 是否为 Manager。
- **Q: ROOT ADMIN 启用机制？** → A: 通过环境变量或部署配置启用（ENABLE_ROOT_ADMIN=true），不通过 UI。v1.0 中 ROOT ADMIN 的启用是运维级操作，通过种子数据或 CLI 创建第一个 ROOT ADMIN 用户。
- **Q: 权限代码预置集的完整范围？** → A: S1-2 实现核心权限代码集：tenant:manage, tenant:view_audit, group:create, group:manage, app:register, app:grant, app:use, conversation:view_others, conversation:export。后续切片可扩展。
- **Q: 显式拒绝（Deny）由谁创建？** → A: 仅 Tenant Admin 可创建 Deny。通过 AppGrant.permission='deny' 实现。Deny 无有效期限制，需手动撤销。
- **Q: 权限判定 ≤50ms 的实现策略？** → A: 性能要求不指定实现方式，由实现层面解决。Spec 同时要求"权限判定 P95 ≤50ms"和"权限变更 ≤5s 全平台生效"。
- **Q: 权限判定的输入输出接口？** → A: 每次业务请求时实时判定，不依赖登录时一次性计算。输入：(userId, tenantId, activeGroupId, resourceType, action)。输出：(allowed, reason, matchedGrant?)。
- **Q: 多 Tenant + 多 Group 场景下的 Active Group 默认值？** → A: 切换 Tenant 后取该 Tenant 下用户上次使用的 Group。首次进入 Tenant 时默认为 Default Group。本地持久化格式为 `{tenantId: lastActiveGroupId}`。
- **Q: Group Switcher 仅展示有权群组？** → A: 应用上下文中仅展示对当前应用有授权的群组；非应用上下文中展示用户所有所属群组。
- **Q: Manager 用户级授权与 Tenant Admin 用户直授的区别？** → A: S1-2 建立数据模型支持，但 Manager 用户级授权的完整管理 UI 在 S3-1（F-MGR-005）。Manager 用户级授权依托群组授权范围，可选填原因，无有效期限制。
- **Q: Break-glass 的站内信通知？** → A: S1-2 实现最小通知能力，不实现完整站内信系统。Break-glass 触发时在 Tenant Admin 管理后台显示未读通知标记。
- **Q: Break-glass 访问范围？** → A: 需指定目标 Tenant，不可跨 Tenant 通行。获得的权限等同于该 Tenant 的 Tenant Admin（但有审计和时限约束）。
- **Q: App 实体在 S1-2 的最小定义？** → A: S1-2 仅需 App 最小结构：id、tenantId、name、status。其他字段在 S1-3 补充。
- **Q: 授权变更的审计复用 S1-1 基础设施？** → A: 是。新增审计事件类型：grant.created, grant.revoked, grant.expired, deny.created, deny.revoked, breakglass.activated, breakglass.expired, role.assigned, role.removed。
- **Q: 最后一个 Tenant Admin 保护？** → A: 系统必须阻止最后一个 Tenant Admin 的角色降级或删除。降级操作前检查当前 Tenant 的 Tenant Admin 数量。
- **Q: UserRole.expiresAt 的使用场景？** → A: 主要用于 Break-glass 临时角色提升（1 小时过期）和未来临时角色分配。系统需定期清理过期记录。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 三级 RBAC 角色体系与权限判定引擎 (Priority: P1)

系统建立 ROOT ADMIN/Tenant Admin/User 三级 RBAC 角色体系，并以稳定的优先级链判定权限。ROOT ADMIN 默认关闭需显式启用（通过环境变量）。Tenant Admin 拥有租户内最高治理权限。Manager 不是 Role 表中的独立角色，而是通过 GroupMember.role='manager' 判定的 Group 级角色绑定，权限仅在其被绑定的群组内生效。User 为普通使用者。权限判定引擎在 50ms 内完成判定。

**Why this priority**: 这是整个授权系统的基础引擎，所有后续功能（群组授权、用户直授、内容可见性）都依赖角色体系和权限判定能力。没有此功能，系统无法区分用户权限边界。

**Independent Test**: 可通过角色权限测试独立验证 - 创建不同角色用户 → 配置角色权限 → 验证各角色权限边界 → 测试权限判定优先���链 → 测量权限判定响应时间

**Acceptance Scenarios**:

1. **Given** 系统初始化完成，**When** 查询预置角色，**Then** 系统包含 ROOT ADMIN（isSystem=true, 默认关闭）、Tenant Admin、User 三种预置角色（Manager 通过 GroupMember.role 判定）
2. **Given** 用户被分配 Tenant Admin 角色，**When** 用户在租户内执行管理操作，**Then** 操作被允许并记录审计日志
3. **Given** 用户在群组 A 中通过 GroupMember.role='manager' 绑定为 Manager，**When** 尝试管理群组 B 的成员，**Then** 操作被拒绝并提示权限不足
4. **Given** 用户同时拥有群组授权 Allow 和用户直授 Allow，**When** 判定权限，**Then** 权限判定返回 Allow（按优先级链）
5. **Given** 用户在群组 A 有 Deny 授权，在群组 B 有 Allow 授权，**When** 判定权限，**Then** 权限判定返回 Deny（Deny 优先级最高）
6. **Given** 发起任意权限判定请求，**When** 测量响应时间，**Then** P95 响应时间 ≤ 50ms
7. **Given** Tenant Admin 尝试删除系统预置角色（isSystem=true），**When** 执行删除操作，**Then** 操作被拒绝并提示系统角色不可删除
8. **Given** Tenant Admin 尝试将自己降级为 User 且是最后一个 Admin，**When** 执行降级操作，**Then** 操作被拒绝并提示需先指定另一个 Tenant Admin

---

### User Story 2 - 群组→应用授权主路径 (Priority: P1)

Tenant Admin 将应用授权给群组，用户通过群组成员身份获得应用访问权限。这是应用访问授权的主路径。授权和撤销即时生效（≤5s 全平台生效）并纳入审计。用户可见所有有权访问的应用（多群组权限并集）。

**Why this priority**: 这是应用访问控制的核心机制，绝大多数用户通过群组获得应用访问权限。没有此功能，用户无法访问任何应用。

**Independent Test**: 可通过群组授权流程独立验证 - Tenant Admin 授权应用给群组 → 添加用户到群组 → 用户查看应用列表 → 验证可见性 → 撤销授权 → 验证权限即时失效

**Acceptance Scenarios**:

1. **Given** Tenant Admin 已登录，**When** 将应用 A 授权给群组 B（permission=use），**Then** 授权立即生效并记录审计日志
2. **Given** 用户是群组 B 的成员，**When** 查看应用列表，**Then** 应用 A 可见并可访问
3. **Given** 用户同时属于群组 B 和群组 C，**When** 两个群组都被授予应用 A 访问权，**Then** 用户可见应用 A（权限并集）
4. **Given** Tenant Admin 撤销群组 B 对应用 A 的授权，**When** 5 秒后用户在群组 B 上下文中尝试访问应用 A，**Then** 访问被拒绝
5. **Given** 仅 Tenant Admin 角色用户，**When** 尝试执行群组→应用授权，**Then** 操作成功
6. **Given** Manager 角色用户，**When** 尝试执行群组→应用授权，**Then** 操作被拒绝（此操作仅 Tenant Admin 可执行）
7. **Given** 用户属于群组 B 但群组未被授权应用 A，**When** 查看应用列表，**Then** 应用 A 完全不可见（而非灰显）

---

### User Story 3 - 当前工作群组与配额归因 (Priority: P1)

多群组用户可选择当前工作群组（Active Group Context），配额扣减和数据归因到当前工作群组。选择机制包括默认上次使用群组（本地持久化，按 Tenant 维度）、顶部导航 Group Switcher、API Header X-Active-Group-ID。单群组用户隐藏切换器。扣费群组必须是授予该 App 访问权的群组之一。切换 Tenant 后 Active Group 取该 Tenant 下用户上次使用的 Group，首次进入则默认为 Default Group。

**Why this priority**: 这是多群组场景下配额管理和成本归因的核心能力。没有此功能，无法准确追踪使用成本和执行配额策略。

**Independent Test**: 可通过工作群组切换独立验证 - 用户属于多个群组 → 用户切换当前工作群组 → 使用应用并产生配额消耗 → 验证配额扣减归因到正确的群组

**Acceptance Scenarios**:

1. **Given** 用户属于多个群组，**When** 登录后查看顶部导航，**Then** 显示 Group Switcher 并默认选中上次使用的群组
2. **Given** 用户仅属于一个群组，**When** 查看顶部导航，**Then** Group Switcher 被隐藏
3. **Given** 用户在顶部导航切换群组，**When** 切换完成，**Then** 后续请求归因到新群组，切换立即生效
4. **Given** 用户通过 API 调用（携带 X-Active-Group-ID header），**When** 请求执行，**Then** 配额归因到 header 指定的群组
5. **Given** 用户尝试将配额归因到未授权当前应用的群组，**When** 发起请求，**Then** 请求被拒绝并提示群组无应用访问权限
6. **Given** 用户上次使用群组 A，**When** 本次登录，**Then** 系统自动恢复群组 A 为当前工作群组（本地持久化）
7. **Given** 多群组用户使用应用产生配额消耗，**When** 查看使用统计，**Then** 消耗归因到当前工作群组
8. **Given** 用户切换到另一个 Tenant，**When** 查看当前工作群组，**Then** 显示该 Tenant 下用户上次使用的群组，首次进入则显示 Default Group
9. **Given** 用户在应用上下文中查看 Group Switcher，**When** 当前群组未授权该应用，**Then** Switcher 仅展示已授权该应用的群组

---

### User Story 4 - 内容可见性边界 (Priority: P1)

系统强制执行三级可见性边界：User 仅可查看自己的对话内容；Manager 可查看团队统计与用户级指标排行（仅指标），数据范围严格限制为当前 Group 上下文产生的数据，不可查看成员对话内容/摘要；Tenant Admin 查看成员对话需填写事由并产生审计记录，仅在当前会话有效。

**Why this priority**: 这是数据隐私和合规的核心保障。没有明确的可见性边界，可能产生数据泄露和合规风险。

**Independent Test**: 可通过可见性边界测试独立验证 - 不同角色用户访问数据 → 验证可见范围 → Manager 尝试跨组访问 → Tenant Admin 查看他人对话

**Acceptance Scenarios**:

1. **Given** User 角色用户，**When** 查看对话列表，**Then** 仅显示自己创建的对话
2. **Given** Manager 角色用户，**When** 查看群组统计，**Then** 显示当��� Group 上下文的统计数据和用户级指标排行（仅指标，不含对话内容）
3. **Given** Manager 角色用户在群组 A，**When** 尝试查看群组 B 的统计数据，**Then** 访问被拒绝
4. **Given** Manager 角色用户，**When** 尝试查看成员的对话内容或摘要，**Then** 访问被拒绝
5. **Given** Tenant Admin 角色用户，**When** 尝试查看成员对话，**Then** 系统要求填写事由并生成审计记录
6. **Given** Tenant Admin 已填写事由查看成员对话，**When** 登出后重新登录，**Then** 需重新填写事由才能查看（访问权限仅在当前会话有效）
7. **Given** Manager 角色用户，**When** 尝试聚合展示用户跨组或个人空间行为数据，**Then** 操作被拒绝

---

### User Story 5 - 用户直授例外授权 (Priority: P2)

Tenant Admin 可对个别用户进行应用直授，绕过群组结构。必须填写原因和有效期（默认7天，最长90天）。到期自动撤销。需纳入审计。用于临时授权或特殊场景。

**Why this priority**: 这是例外授权机制，满足临时授权需求但不是主路径。相比群组授权是增强功能。

**Independent Test**: 可通过用户直授流程独立验证 - Tenant Admin 对用户直授应用 → 填写原因和有效期 → 用户获得访问权限 → 到期后权限自动撤销

**Acceptance Scenarios**:

1. **Given** Tenant Admin 已登录，**When** 对用户直授应用访问权，**Then** 系统要求填写原因和有效期
2. **Given** Tenant Admin 填写原因并选择有效期，**When** 提交直授授权，**Then** 授权立即生效并记录审计日志
3. **Given** 用户获得直授授权，**When** 查看应用列表，**Then** 被直授的应用可见并可访问（即使用户所属群组未被授权）
4. **Given** 用户直授授权达到有效期，**When** 尝试访问应用，**Then** 访问被拒绝，权限已自动撤销
5. **Given** Tenant Admin 尝试设置有效期超过 90 天，**When** 提交表单，**Then** 系统拒绝并提示最长有效期为 90 天
6. **Given** 用户同时拥有群组授权和用户直授，**When** 判定权限，**Then** 用户直授优先级高于群组授权（但低于 Deny）
7. **Given** Manager 角色用户，**When** 尝试执行用户直授授权，**Then** 操作被拒绝（此操作仅 Tenant Admin 可执行）

---

### User Story 6 - Break-glass 紧急访问机制 (Priority: P2)

ROOT ADMIN 可通过 Break-glass 紧急访问租户数据，用于运维排障。必须填写事由并指定目标 Tenant，产生最高级别审计（Severity=Critical，不可删除），系统在 Tenant Admin 管理后台显示未读通知标记。访问权限仅在本次会话或 1 小时内有效，不可跨 Tenant 通行。

**Why this priority**: 这是运维应急机制，用于排障等特殊场景，但不是日常操作。相比核心授权是增强功能。

**Independent Test**: 可通过 Break-glass 流程独立验证 - ROOT ADMIN 发起紧急访问 → 填写事由 → 获得临时访问权限 → Tenant Admin 收到通知 → 1 小时后权限自动失效

**Acceptance Scenarios**:

1. **Given** ROOT ADMIN 已登录且 ROOT ADMIN 角色已启用，**When** 尝试访问租户数据，**Then** 系统要求填写事由并指定目标 Tenant（Break-glass 流程）
2. **Given** ROOT ADMIN 填写事由并选择目标 Tenant，**When** 提交访问请求，**Then** 临时访问权限授予（等同于该 Tenant 的 Tenant Admin），审计记录生成（Severity=Critical，不可删除）
3. **Given** ROOT ADMIN 完成 Break-glass 访问，**When** 查看审计日志，**Then** 审计记录包含事由、时间、目标 Tenant、访问范围，且无法被删除
4. **Given** Break-glass 访问授权后，**When** Tenant Admin 查看管理后台，**Then** 显示未读通知标记（Break-glass 警报）
5. **Given** Break-glass 访问授权已 1 小时，**When** ROOT ADMIN 尝试继续访问，**Then** 访问被拒绝，权限已自动失效
6. **Given** ROOT ADMIN 登出后重新登录，**When** 尝试访问租户数据，**Then** 需重新发起 Break-glass 流程（权限仅在会话有效）
7. **Given** ROOT ADMIN 角色未启用，**When** 尝试访问租户数据，**Then** 访问被拒绝，ROOT ADMIN 功能默认关闭

---

### User Story 7 - 智能上下文切换 (Priority: P2)

用户可见所有有权访问的应用（基于多群组权限并集），不受当前 Context 限制。点击应用时系统智能判断：若当前 Context 已授权则直接进入；若未授权且仅属一个有效群组则自动切换并提示；若属多个有效群组则弹窗选择。

**Why this priority**: 这是用户体验优化，减少用户手动切换群组的操作。相比核心授权功能是增强体验。

**Independent Test**: 可通过智能切换流程独立验证 - 多群组用户查看应用列表 → 点击应用 → 系统智能判断群组上下文 → 自动切换或弹窗选择

**Acceptance Scenarios**:

1. **Given** 多群组用户查看应用列表，**When** 查看可用应用，**Then** 显示所有有权访问的应用（基于群组权限并集）
2. **Given** 用户当前工作群组已授权应用 A，**When** 点击应用 A，**Then** 直接进入应用，无需切换
3. **Given** 用户当前工作群组未授权应用 A，**When** 用户仅在群组 B 中有应用 A 访问权，**Then** 系统自动切换到群组 B 并提示用户
4. **Given** 用户当前工作群组未授权应用 A，**When** 用户在群组 B 和群组 C 中都有应用 A 访问权，**Then** 系统弹窗让用户选择目标群组
5. **Given** 用户在弹窗中选择群组 B，**When** 确认选择，**Then** 系统切换到群组 B 并进入应用 A
6. **Given** 用户无任何群组授��应用 A，**When** 查看应用列表，**Then** 应用 A 完全不可见

---

### Edge Cases

- **权限变更即时生效**: Admin 撤销群组授权后，用户正在进行的会话如何处理？≤5s 全平台生效，既有请求可完成但新请求被拦截
- **授权过期自动失效**: 用户直授到期后，系统立即拦截，无宽限期
- **多群组权限冲突**: 用户在群组 A 有 Allow，在群组 B 有 Deny，Deny 优先级最高
- **Group Switcher 边界**: 用户只属于一个群组时隐藏切换器；当前群组未授权目标应用时自动切换或弹窗选择
- **Break-glass 时限**: ROOT ADMIN 紧急访问 1 小时后自动失效，不可续期
- **Manager 可见性边界**: Manager 只看到当前 Group 上下文的统计数据，跨 Group 的数据不可见
- **Tenant Admin 查看对话**: 必须填写事由，系统记录审计，且仅在当前会话有效
- **无授权应用不可见**: 用户在应用列表中完全看不到无权访问的应用（而非灰显）
- **角色降级**: Tenant Admin 将自己降级为 User，系统应有保护机制防止最后一个 Admin 降级
- **配额归因约束**: 扣费群组必须是授予该 App 访问权的群组之一，否则请求���拒绝
- **ROOT ADMIN 未启用**: ROOT ADMIN 角色默认关闭，需显式配置启用后才能使用
- **系统预置角色不可删除**: isSystem=true 的角色无法被删除，保证系统基础架构完整性
- **最后一个 Tenant Admin 保护**: Tenant Admin 将自己降级为 User 时，如果是最后一个 Admin，系统拒绝操作并提示
- **Deny 记录无自动过期**: Deny 记录需手动撤销，不会像用户直授那样自动过期
- **多 Tenant 场景下的 Active Group**: 切换 Tenant 后，Active Group 取该 Tenant 下用户上次使用的 Group；首次进入则默认为 Default Group

### Scope Boundaries

**In-Scope（本切片覆盖）**:
- 角色体系（RBAC）：三级 RBAC 角色（ROOT ADMIN/Tenant Admin/User）+ Group级 Manager（通过 GroupMember.role 判定）
- 应用访问授权：群组→应用授权（主路径）、用户直授例外授权
- 权限判定：优先级链、ABAC 附加条件、50ms 性能目标
- 多群组权限合并：访问权限并集、配额归因到当前工作群组
- 内容可见性边界：User/Manager/Tenant Admin 三级可见性
- Break-glass 紧急访问：ROOT ADMIN 运维排障机制
- 智能上下文切换：应用可见性基于权限并集，自动/手动群组切换

**Out-of-Scope（不在本切片范围，留待后续）**:
- 应用管理 CRUD（属于 S1-3 切片的 F-APP-* 系列）
- 配额管理与配额策略（属于 S1-3 切片的 F-QUOTA-* 系列）
- 统计报表和仪表盘（属于 S3 Stage 切片）
- Manager 群组内用户级授权的完整 UI（属于 S3-1 的 F-MGR-005，S1-2 仅建立 AppGrant 模型支持 granteeType=user）
- 完整站内信系统（S1-2 仅实现 Break-glass 通知标记，完整收件箱属于 S3）
- S1-1 已实现的能力：认证、用户状态、审计写入基础能力

## Requirements *(mandatory)*

### Functional Requirements

**角色体系 (F-IAM-001)**
- **FR-001**: 系统 MUST 提供三级 RBAC 角色：ROOT ADMIN（Platform 作用域）、Tenant Admin（Tenant 作用域）、User（User 作用域）。Manager 不是 Role 表中的独立角色，而是通过 GroupMember.role='manager' 判定。
- **FR-002**: 系统 MUST 设置 ROOT ADMIN 默认状态为关闭，需通过环境变量 ENABLE_ROOT_ADMIN=true 显式启用（运维级操作，不通过 UI）。
- **FR-003**: 系统 MUST 标记预置角色为系统角色（isSystem=true），系统角色不可删除。预置角色为 root_admin、tenant_admin、user。
- **FR-004**: 系统 MUST 确保 Manager 权限仅在其被绑定的群组内生效（通过 GroupMember.role='manager' 判定）。
- **FR-005**: 系统 MUST 支持用户同时担任多个群组的 Manager。
- **FR-005-1**: 系统 MUST 在每次业务请求时实时判定权限，输入为 (userId, tenantId, activeGroupId, resourceType, action)，输出为 (allowed, reason, matchedGrant?)。

**Break-glass 紧急访问 (F-IAM-002)**
- **FR-006**: 系统 MUST 要求 ROOT ADMIN 在紧急访问时填写事由并指定目标 Tenant。
- **FR-007**: 系统 MUST 生成最高级别审计记录（Severity=Critical）用于 Break-glass 操作，且该记录不可删除。
- **FR-008**: 系统 MUST 在 Tenant Admin 管理后台显示未读通知标记（最小通知能力，完整站内信系统属于 S3 范围）。
- **FR-009**: 系统 MUST 限制 Break-glass 访问权限在本次会话或 1 小时内有效，超时自动失效，不可跨 Tenant 通行。

**应用访问授权 (F-IAM-003)**
- **FR-010**: 系统 MUST 仅允许 Tenant Admin 执行群组→应用授权操作
- **FR-011**: 系统 MUST 在授权/撤销操作后即时生效（≤5s 全平台生效）
- **FR-012**: 系统 MUST 将所有授权/撤销操作纳入审计日志
- **FR-013**: 系统 MUST 支持通过群组为成员提供应用访问权限（主路径）

**用户直授例外授权 (F-IAM-004)**
- **FR-014**: 系统 MUST 仅允许 Tenant Admin 执行用户直授授权
- **FR-015**: 系统 MUST 要求填写授权原因
- **FR-016**: 系统 MUST 要求设置有效期，默认 7 天，最长 90 天
- **FR-017**: 系统 MUST 在用户直授到期后自动撤销授权
- **FR-018**: 系统 MUST 将用户直授操作纳入审计日志

**授权优先级与显式拒绝 (F-IAM-005)**
- **FR-019**: 系统 MUST 按以下优先级判定权限：Deny（显式拒绝）> 用户直授 Allow > 群组授权/Manager用户级授权 Allow（同级）> 默认拒绝。
- **FR-020**: 系统 MUST 确保 ABAC 仅作为 Allow/Deny 附加条件，不单独产生授权。（注：v1.0 预留扩展点，具体 ABAC 条件实现留待后续切片）
- **FR-021**: 系统 MUST 在 50ms 内完成权限判定（P95）。
- **FR-021-1**: 系统 MUST 仅允许 Tenant Admin 创建和撤销显式拒绝（Deny）记录。
- **FR-021-2**: Deny 记录无自动过期机制，需手动撤销。

**多群组权限合并与归因 (F-IAM-006)**
- **FR-022**: 系统 MUST 按并集（OR）合并多群组访问权限，任一群组授予即可访问
- **FR-023**: 系统 MUST 将配额/扣费归因到当前工作群组
- **FR-024**: 系统 MUST 确保扣费群组必须是授予该 App 访问权的群组之一
- **FR-025**: 系统 MUST 支持三种当前工作群组选择机制：默认上次使用群组（本地持久化）、顶部导航 Group Switcher、API Header X-Active-Group-ID
- **FR-026**: 系统 MUST 在用户仅属于单一群组时隐藏 Group Switcher
- **FR-026-1**: 系统 MUST 按 Tenant 维度持久化用户上次使用的 Active Group（格式为 {tenantId: lastActiveGroupId}）
- **FR-026-2**: 系统 MUST 在首次进入 Tenant 时默认 Active Group 为 Default Group
- **FR-026-3**: Group Switcher 在应用上下文中仅展示对当前应用有授权的群组，在非应用上下文中展示用户所有所属群组

**内容可见性边界 (F-IAM-007)**
- **FR-027**: 系统 MUST 限制 User 仅可查看自己的对话内容
- **FR-028**: 系统 MUST 允许 Manager 查看团队统计与用户级指标排行（仅指标）
- **FR-029**: 系统 MUST 限制 Manager 可见数据范围为当前 Group 上下文产生的数据
- **FR-030**: 系统 MUST 禁止 Manager 查看成员对话内容/摘要
- **FR-031**: 系统 MUST 禁止 Manager 聚合展示用户跨组或个人空间行为数据
- **FR-032**: 系统 MUST 要求 Tenant Admin 填写事由才能查看成员对话
- **FR-033**: 系统 MUST 为 Tenant Admin 查看成员对话生成审计记录
- **FR-034**: 系统 MUST 限制 Tenant Admin 查看成员对话权限仅在当前会话有效

**智能上下文切换 (F-IAM-008)**
- **FR-035**: 系统 MUST 显示用户所有有权访问的应用（基于多群组权限并集）
- **FR-036**: 系统 MUST 在当前 Context 已授权时直接进入应用
- **FR-037**: 系统 MUST 在当前 Context 未授权且用户仅属于一个有效群组时自动切换并提示
- **FR-038**: 系统 MUST 在当前 Context 未授权且用户属于多个有效群组时弹窗选择
- **FR-039**: 系统 MUST 在用户无任何群组授权时使应用完全不可见

**审计覆盖**
- **FR-040**: 系统 MUST 记录所有角色变更操作到审计日志
- **FR-041**: 系统 MUST 记录所有授权/撤销操作到审计日志
- **FR-042**: 系统 MUST 记录 Break-glass 操作到审计日志（Severity=Critical）
- **FR-043**: 系统 MUST 记录 Tenant Admin 查看成员对话操作到审计日志
- **FR-044**: 系统 MUST 记录权限判定失败到审计日志
- **FR-045**: 系统 MUST 复用 S1-1 的 AuditEvent 基础设施，新增审计事件类型：grant.created, grant.revoked, grant.expired, deny.created, deny.revoked, breakglass.activated, breakglass.expired, role.assigned, role.removed

**数据维护**
- **FR-046**: 系统 MUST 定期检查并自动清理过期的 UserRole 和 AppGrant 记录
- **FR-047**: 系统 MUST 阻止 Tenant 下最后一个 Tenant Admin 的角色降级或删除

### Key Entities

- **Role（角色）**: 角色定义表，包含 id、name（角色标识）、displayName（显示名称）、description（描述）、isSystem（系统角色不可删除）、isActive（是否启用）。预置角色：root_admin、tenant_admin、user（注意：Manager 不是 Role 表中的独立角色，而是通过 GroupMember.role='manager' 判定）。
- **Permission（权限）**: 权限定义表，包含 id、code（权限代码，格式 {category}:{action}）、name（权限名称）、category（分类）、isActive（是否启用）。S1-2 核心权限代码：tenant:manage, tenant:view_audit, group:create, group:manage, app:register, app:grant, app:use, conversation:view_others, conversation:export。
- **RolePermission（角色-权限关联）**: 角色与权限的多对多关联表，包含 roleId、permissionId、createdAt。
- **UserRole（用户-角色关联）**: 用户与角色的多对多关联表，包含 userId、roleId、tenantId（角色生效的租户范围）、expiresAt（过期时间，用于 Break-glass 临时角色提升等场景）、createdAt。用户与 Tenant 为 N:N 关系，通过 UserRole 关联。
- **AppGrant（应用授权）**: 应用访问授权记录，包含 id、appId（应用 ID）、granteeType（group/user）、granteeId（群组 ID 或用户 ID）、permission（use/deny）、reason（授权原因，用户直授必填）、grantedBy（授权人）、expiresAt（过期时间）、createdAt。仅 Tenant Admin 可创建和撤销 Deny 记录。
- **App（应用，S1-2 最小结构）**: 注册的 AI 应用，S1-2 仅需最小字段集：id、tenantId（所属租户）、name（应用名称）、status（active/disabled）。完整定义（externalId、externalPlatform、mode、icon、config 等）在 S1-3。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 权限判定延迟 P95 ≤ 50ms
- **SC-002**: 四级角色体系（ROOT/ADMIN/MANAGER/USER）权限分离正确性达到 100%
- **SC-003**: Break-glass 操作产生 Critical 级别审计记录，审计级别正确性达到 100%
- **SC-004**: 群组→应用授权后用户可见应用，可见性正确性达到 100%
- **SC-005**: 用户直授需记录原因和有效期，必填字段验证率达到 100%
- **SC-006**: Deny 优先于 Allow，优先级判定正确性达到 100%
- **SC-007**: 多群组权限合并为并集，合并逻辑正确性达到 100%
- **SC-008**: 群组切换交互正确性达到 100%
- **SC-009**: 无授权应用不出现在列表，完全不可见（而非灰显）
- **SC-010**: 权限变更生效时间 ≤ 5s 全平台生效
- **SC-011**: 授权过期自动失效，到期待拦截率达到 100%
- **SC-012**: Manager 仅能查看当前 Group 上下文统计数据，边界正确性达到 100%
- **SC-013**: Tenant Admin 查看成员对话需填写事由，强制验证率达到 100%
- **SC-014**: Break-glass 访问 1 小时后自动失效，超时失效率达到 100%
- **SC-015**: 用户直授最长有效期 90 天，超限拒绝率达到 100%
- **SC-016**: 配额归因到当前工作群组正确性达到 100%
- **SC-017**: 扣费群组必须是授予该 App 访问权的群组之一，约束验证率达到 100%
- **SC-018**: 系统预置角色（isSystem=true）不可删除，保护机制正确性达到 100%

### Performance Targets

- **SC-101**: 权限判定响应时间 P95 ≤ 50ms
- **SC-102**: 权限变更生效时间 ≤ 5s
- **SC-103**: 群组切换响应时间 ≤ 300ms
- **SC-104**: 应用列表加载时间 P95 ≤ 500ms

### Security & Compliance

- **SC-201**: 跨角色权限访问必须被拒绝并记录异常审计事件
- **SC-202**: Break-glass 操作必须产生 Critical 级别审计且不可删除
- **SC-203**: Tenant Admin 查看成员对话必须填写事由并记录审计
- **SC-204**: Manager 不得查看成员对话内容/摘要，访问拦截率达到 100%
- **SC-205**: 用户直授必须在到期后自动撤销，到期撤销率达到 100%

---

*本文档基于 .specify/templates/spec-template.md 生成*
