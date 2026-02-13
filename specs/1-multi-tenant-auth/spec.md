# Feature Specification: Multi-Tenant Authentication Base (S1-1)

**Feature Branch**: `1-multi-tenant-auth`
**Created**: 2025-02-10
**Status**: Draft
**Input**: S1-1 多租户身份认证基座
**Constitution Check**: 符合 `.specify.specify/memory/constitution.md` 原则

## Clarifications

### Session 2025-02-10

基于 DOMAIN_MODEL_P1.md、PRD.md §2~3、PHASE1_BACKLOG.md 和 feature-list.json 的澄清：

- **Q: 用户-租户绑定模型？** → A: 用户与 Tenant 是 N:N 关系。User 是全局实体（无 tenantId），通过 UserRole.tenantId 关联。用户可属于多个 Tenant，登录后需提供 Tenant/Workspace 选择器。
- **Q: 自注册场景的 Tenant 归属？** → A: 不支持无上下文开放自注册。用户进入 Tenant 只有 3 条路径：①邀请链接（携带 Tenant 上下文）②SSO 登录（邮箱域名匹配）③Tenant Admin 手动创建。
- **Q: Access Token / Refresh Token 有效期？** → A: 15分钟/7天为基于行业惯例的合理默认值，PRD 未明确定义，由 better-auth 默认策略确定，Tenant 可配置覆盖。
- **Q: 账号锁定策略？** → A: PRD 未明确定义，遵循 Constitution "Tenant 是治理最小边界"原则，应为 Tenant 可配置，默认 5 次/30 分钟。
- **Q: SSO 与密码登录共存？** → A: SSO 配置后邮箱密码登录仍然可用，SSO 是"优先推荐"而非"强制唯一"。强制 SSO (enforce_sso) 作为 v2.0 增强功能。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 邀请链接登录与多租户隔离 (Priority: P1)

被邀请用户通过点击邮件链接设置密码后登录系统，用户可属于多个 Tenant，登录后需选择目标 Workspace，租户间数据完全隔离。

**Why this priority**: 这是所有用户进入系统的唯一入口，是多租户隔离的基础，后续所有功能都依赖用户身份和租户上下文。没有此功能，系统完全不可用。

**Independent Test**: 可通过邀请登录流程独立测试 - Tenant Admin 邀请用户 → 用户收到邮件点击链接 → 设置密码 → 登录系统 → 选择 Tenant/Workspace → 验证租户隔离（无法看到其他租户数据）

**Acceptance Scenarios**:

1. **Given** Tenant Admin 邀请用户，**When** 用户点击邮件链接并设置密码，**Then** 用户账号创建并归属于该租户（或活跃或待审核，取决于 Tenant 配置）
2. **Given** 用户已设置密码并处于活跃状态，**When** 输入正确的邮箱密码登录，**Then** 用户成功进入系统并可访问其有权限的 Tenant
3. **Given** 用户属于多个 Tenant，**When** 登录后切换 Tenant/Workspace，**Then** 系统展示当前租户的数据和权限
4. **Given** 用户在 Tenant A 上下文中，**When** 尝试访问 Tenant B 的数据，**Then** 系统拒绝访问并提示权限不足
5. **Given** 用户密码不符合策略（少于8位或缺少大小写/数字），**When** 尝试设置密码，**Then** 系统拒绝并提示密码强度要求

---

### User Story 2 - 群组组织与成员管理 (Priority: P1)

用户归属于一个或多个群组，群组管理员（Manager）可以管理群组成员，同一用户可以在多个群组中担任不同角色。

**Why this priority**: 群组是应用授权和配额分配的组织单元，是租户内权限治理的基础。没有群组，用户无法获得任何应用访问权限。

**Independent Test**: 可通过群组管理流程独立测试 - Tenant Admin 创建群组 → 添加成员 → 指派 Manager → Manager 查看群组成员 → 用户查看自己所属群组

**Acceptance Scenarios**:

1. **Given** Tenant Admin 已登录，**When** 创建新群组并添加成员，**Then** 群组创建成功且成员关联建立
2. **Given** 用户被添加到多个群组，**When** 查看自己的群组列表，**Then** 显示所有所属群组及角色
3. **Given** 用户在群组 A 中是 Manager，**When** 在群组 B 中是普通成员，**Then** 用户在群组 A 有管理权限，在群组 B 无管理权限
4. **Given** Manager 在其管理的群组中，**When** 移除成员，**Then** 成员立即失去该群组相关的应用访问权限

---

### User Story 3 - SSO 自动识别与 JIT 入驻 (Priority: P2)

企业用户输入企业邮箱后，系统自动识别并推荐对应的 SSO 登录方式，用户通过 SSO 首次登录时自动创建账号并初始化。

**Why this priority**: 这是企业级场景的核心体验，能大幅降低企业用户的使用门槛，但相比邮箱密码登录是增强体验而非阻塞性需求。

**Independent Test**: 可通过企业 SSO 流程独立测试 - 配置 Tenant 的 SSO（如企业邮箱域名映射）→ 用户输入企业邮箱 → 系统推荐 SSO 登录 → 用户完成 SSO 认证 → 系统自动创建账号并激活

**Acceptance Scenarios**:

1. **Given** Tenant 配置了企业邮箱域名的 SSO 映射，**When** 用户输入该域名邮箱，**Then** 系统在 500ms 内返回匹配的 SSO 登录方式
2. **Given** 用户输入的邮箱域名无 SSO 配置，**When** 系统检测完成，**Then** 显示其他可用的登录方式（邮箱密码等）
3. **Given** 用户首次通过 SSO 登录，**When** SSO 认证成功，**Then** 系统自动创建用户账号并设置为活跃状态（跳过审核）
4. **Given** SSO 返回的用户邮箱已存在，**When** 用户通过 SSO 登录，**Then** 系统关联现有账号而不创建重复记录

---

### User Story 4 - 用户审核与状态管理 (Priority: P2)

Tenant Admin 可以配置是否开启用户审核。当审核开启时，通过邀请链接加入的用户进入待审核状态；通过 SSO 登录的用户默认自动激活。待审核用户登录后只能访问个人设置页和查看状态提示。

**Why this priority**: 这是企业治理的核心能力，控制谁能进入系统，但相比基本的登录功能是增强性需求。

**Independent Test**: 可通过审核流程独立测试 - Tenant Admin 开启审核 → 用户通过邀请加入进入待审核 → 待审核用户尝试登录（仅能访问个人设置）→ Tenant Admin 审核通过/拒绝 → 用户状态更新并可正常使用/无法使用

**Acceptance Scenarios**:

1. **Given** Tenant 开启审核且用户通过邀请链接加入，**When** 注册完成，**Then** 用户状态为待审核
2. **Given** Tenant 关闭审核且用户通过邀请链接加入，**When** 注册完成，**Then** 用户状态直接为活跃
3. **Given** 用户通过 SSO 首次登录，**When** SSO 认证成功，**Then** 用户状态直接为活跃（跳过审核）
4. **Given** 用户处于待审核状态，**When** 尝试登录，**Then** 登录成功但只能访问个人设置页，并显示待审核状态提示
5. **Given** Tenant Admin 在待审核列表中，**When** 批准用户，**Then** 用户状态变为活跃并可正常使用系统
6. **Given** Tenant Admin 在待审核列表中，**When** 拒绝用户，**Then** 用户状态变为已拒绝且无法登录
7. **Given** Tenant Admin 在用户列表中，**When** 暂停活跃用户，**Then** 用户立即无法登录并提示账号已暂停

---

### User Story 5 - MFA 多因素认证 (Priority: P3)

用户可以启用 TOTP 多因素认证增强账号安全，租户可以配置 MFA 策略（强制/可选/关闭），管理员可以对特定用户强制启用 MFA。

**Why this priority**: 这是安全增强功能，不影响核心登录流程，可延后实现。

**Independent Test**: 可通过 MFA 流程独立测试 - 用户启用 TOTP → 绑定认证器应用 → 下次登录时输入验证码 → 验证通过后成功登录

**Acceptance Scenarios**:

1. **Given** 用户未启用 MFA，**When** 在安全设置中启用 TOTP，**Then** 系统显示二维码和密钥供认证器应用扫描
2. **Given** 用户已启用 MFA，**When** 登录时输入正确密码和 TOTP 验证码，**Then** 登录成功
3. **Given** 用户已启用 MFA，**When** 登录时输入正确密码但错误验证码，**Then** 登录失败并提示验证码错误
4. **Given** Tenant 配置 MFA 为强制，**When** 用户登录，**Then** 必须完成 MFA 验证才能进入系统
5. **Given** Tenant 配置 MFA 为可选，**When** 用户登录，**Then** 可选择是否启用 MFA
6. **Given** Tenant Admin 强制某用户启用 MFA，**When** 该用户下次登录，**Then** 必须完成 MFA 验证（优先级高于租户级策略）

---

### User Story 6 - 用户资料与邀请 (Priority: P3)

用户可以管理个人资料（头像、昵称、语言、时区、主题），Tenant Admin 可以通过邮箱邀请用户，用户点击激活链接设置密码后自动激活。

**Why this priority**: 这是用户体验增强功能，不影响核心认证流程，可延后实现。

**Independent Test**: 可通过资料管理和邀请流程独立测试 - 用户修改头像/昵称/语言偏好 → Tenant Admin 发送邀请邮件 → 用户点击链接设置密码 → 自动激活跳过审核

**Acceptance Scenarios**:

1. **Given** 用户已登录，**When** 修改头像、昵称、语言、时区或主题偏好，**Then** 更新立即生效并在下次登录时保持
2. **Given** Tenant 配置了默认语言，**When** 新用户首次登录，**Then** 界面显示租户默认语言，用户可修改
3. **Given** Tenant Admin 发送邀请邮件给用户，**When** 邮件发送成功，**Then** 邮件包含有效的激活 Token 链接（有效期 7 天）
4. **Given** 用户点击邀请链接，**When** 设置密码完成，**Then** 用户状态自动激活，跳过审核流程
5. **Given** 用户点击过期邀请链接，**When** 尝试设置密码，**Then** 系统提示链接已过期，需管理员重新邀请

---

### Edge Cases

- **并发登录场景**: 同一用户在多设备同时登录，系统应允许并发会话，但任一设备登出不影响其他设备（除非实现强制单点登录）
- **Token 过期处理**: Access Token 过期时，系统应自动使用 Refresh Token 刷新，Refresh Token 也过期时需重新登录
- **多群组权限冲突**: 用户在群组 A 是 Manager（有权限），在群组 B 是普通成员（无权限），对同一资源权限判定按并集处理
- **SSO 配置错误降级**: SSO 提供服务不可用时，系统应显示其他可用登录方式，不阻塞用户进入
- **密码策略边界**: 用户修改密码时不能与最近 N 个历史密码重复（N 可配置 3-12 个）
- **邀请链接过期**: 用户点击过期邀请链接时，系统应提示链接已失效并联系管理员重新发送
- **审核状态转换**: 用户从待审核变为活跃后，下次登录直接进入系统（无需重新登录）
- **跨租户访问**: 用户尝试访问 URL 中的其他租户 ID 时，系统应拒绝并返回到自己的租户空间
- **Manager 权限边界**: Manager 只能在其被绑定的群组内行使管理权限，对其他群组无特殊权限
- **邮箱域名冲突**: 多个 Tenant 配置相同邮箱域名时，系统应返回所有匹配的 SSO 选项供用户选择
- **多租户工作区切换**: 用户属于多个 Tenant 时，登录后应提供 Tenant/Workspace 选择器，切换后数据和权限随之变更
- **无上下文自注册**: 用户无法在无 Tenant 上下文的情况下自注册，必须通过邀请链接（携带 Tenant）、SSO 域名匹配或管理员创建进入系统

## Requirements *(mandatory)*

### Functional Requirements

**多租户隔离 (F-ORG-001)**
- **FR-001**: 系统 MUST 提供 Tenant 作为最高级数据隔离与治理单元，确保不同租户的数据、权限、配额、审计、策略完全隔离
- **FR-002**: 系统 MUST 在所有业务表中包含 tenant_id 字段，查询必须携带租户上下文（User 为全局实体，通过 UserRole 关联租户）
- **FR-003**: 系统 MUST 支持租户级配置，包括认证方式、密码策略、MFA 策略、默认语言等

**群组组织 (F-ORG-002, F-ORG-003)**
- **FR-004**: 系统 MUST 在 Tenant 内提供 Group 组织单元，用于成员组织、应用授权和配额分配
- **FR-005**: 系统 MUST 支持同一用户属于多个群组，并可在多个群组中担任 Manager
- **FR-006**: 系统 MUST 确保 Manager 权限仅在其被绑定的群组内生效

**多租户用户关系**
- **FR-006-1**: 系统 MUST 支持用户属于多个 Tenant（N:N 关系），通过 UserRole 实体关联
- **FR-006-2**: 系统 MUST 在用户登录后提供 Tenant/Workspace 选择器（当用户属于多个 Tenant 时）
- **FR-006-3**: 系统 MUST 确保每次请求在单一 Tenant 上下文中执行，数据按 Tenant 隔离

**邮箱密码登录 (F-AUTH-001)**
- **FR-007**: 系统 MUST 支持用户通过邀请链接设置密码后登录
- **FR-008**: 系统 MUST 在设置密码时验证邮箱格式唯一性（在 Tenant 范围内或全局）
- **FR-009**: 系统 MUST 在登录时验证邮箱和密码匹配性
- **FR-007-1**: 系统 MUST 支持 Tenant Admin 配置启用/关闭邮箱密码登录方式
- **FR-007-2**: 系统 MUST 支持邀请链接携带 Tenant 上下文，用户通过链接自动归属到对应租户

**密码策略 (F-AUTH-005)**
- **FR-010**: 系统 MUST 强制密码最小长度为 8 位
- **FR-011**: 系统 MUST 要求密码包含大写字母、小写字母和数字
- **FR-012**: 系统 MUST 支持配置密码有效期（30-365 天可配）
- **FR-013**: 系统 MUST 支持配置历史密码限制（3-12 个可配），修改密码时不能与历史密码重复

**SSO 自动识别 (F-AUTH-002)**
- **FR-014**: 系统 MUST 在用户输入邮箱后 500ms 内返回匹配的 SSO 登录方式
- **FR-015**: 系统 MUST 支持基于邮箱域名匹配 Tenant 的 SSO 配置
- **FR-016**: 系统 MUST 在无匹配 SSO 时显示其他可用登录方式

**JIT 用户创建 (F-AUTH-003)**
- **FR-017**: 系统 MUST 在用户首次通过 SSO 登录时自动创建用户账号
- **FR-018**: 系统 MUST 将 SSO 登录创建的用户设置为活跃状态（跳过审核）

**用户状态与审核 (F-AUTH-004)**
- **FR-019**: 系统 MUST 支持用户状态：活跃、暂停、待审核、已拒绝
- **FR-020**: 系统 MUST 支持通过邀请链接创建的用户进入待审核或活跃状态（取决于 Tenant 是否开启审核）
- **FR-020-1**: 系统 MUST 支持 Tenant Admin 配置是否开启用户审核
- **FR-021**: 系统 MUST 允许待审核用户登录，但仅能访问个人设置页和查看状态提示
- **FR-022**: 系统 MUST 支持 Tenant Admin 审批待审核用户（通过/拒绝）

**MFA 多因素认证 (F-AUTH-006)**
- **FR-023**: 系统 MUST 支持 TOTP 多因素认证
- **FR-024**: 系统 MUST 支持租户级 MFA 策略：强制、可选、关闭
- **FR-025**: 系统 MUST 支持 Tenant Admin 对特定用户强制启用 MFA（优先级高于租户级策略）

**用户资料与偏好 (F-AUTH-007)**
- **FR-026**: 系统 MUST 支持用户管理头像、昵称、语言、时区、主题偏好
- **FR-027**: 系统 MUST 支持租户配置默认语言
- **FR-028**: 系统 MUST 支持主题偏好：租户默认 + 用户覆盖

**用户邀请 (F-AUTH-008)**
- **FR-029**: 系统 MUST 支持 Tenant Admin 通过邮箱邀请用户
- **FR-030**: 系统 MUST 发送含激活 Token 的邮件链接
- **FR-031**: 系统 MUST 要求用户点击链接后设置密码
- **FR-032**: 系统 MUST 在用户设置密码后自动激活账号（跳过审核）
- **FR-033**: 系统 MUST 设置邀请链接有效期为默认 7 天，过期需重新邀请

**审计日志**
- **FR-034**: 系统 MUST 记录登录/登出事件到审计日志
- **FR-035**: 系统 MUST 记录失败登录尝试
- **FR-036**: 系统 MUST 记录用户状态变更（审核、暂停、激活等）
- **FR-037**: 系统 MUST 记录 Token 发放和撤销事件

**会话管理**
- **FR-038**: 系统 MUST 支持 Access Token 和 Refresh Token 会话管理（具体有效期由 better-auth 默认策略确定）
- **FR-039**: 系统 MUST 在 Access Token 过期时使用 Refresh Token 自动刷新
- **FR-040**: 系统 MUST 在 Refresh Token 过期时要求用户重新登录
- **FR-041**: 系统 MUST 支持管理员撤销用户会话（用于强制登出）

**安全边界**
- **FR-042**: 系统 MUST 拒绝跨租户数据访问请求（用户可属于多个 Tenant，但每次请求必须在单一 Tenant 上下文中执行）
- **FR-043**: 系统 MUST 支持账号锁定策略，默认失败登录 5 次后锁定 30 分钟，Tenant Admin 可配置锁定阈值和时长
- **FR-044**: 系统 MUST 支持管理员重置用户密码
- **FR-045**: 系统 MUST 支持管理员强制用户启用 MFA

### Key Entities

- **Tenant (租户)**: 最高级数据隔离与治理单元，包含租户名称、状态、计划、自定义配置。UI 中展示为 "Workspace"。所有业务实体必须关联到 Tenant。
- **Group (群组)**: Tenant 内的组织单元，用于成员组织、应用授权和配额分配。UI 中展示为 "Team"。包含名称、描述、排序等属性。
- **GroupMember (群组成员)**: 用户与群组的多对多关联表，包含用户 ID、群组 ID、角色（member/manager）。
- **User (用户)**: 全局系统用户实体（无 tenantId），包含邮箱、姓名、头像、手机号、状态、邮箱验证状态、MFA 启用状态、偏好设置、最后活跃时间。用户与 Tenant 为 N:N 关系，通过 UserRole 关联。
- **TenantAdminUser (租户用户关联)**: 用户��租户的多对多关联表，包含用户 ID、租户 ID、角色（Tenant Admin/User）。v1.0 用户仅属于单一租户，预留扩展支持跨租户。
- **UserStatus**: 枚举类型，包含 active（活跃）、pending（待审核）、suspended（暂停）、rejected（已拒绝）。
- **PasswordPolicy**: 密码策略配置，包含最小长度、复杂度要求、有效期、历史密码限制数量。支持 Tenant 级可配置。
- **SSOConfig**: SSO 配置，包含邮箱域名映射、SSO 类型（Google/GitHub/WeChat/CAS/OIDC/SAML/OAuth2）、配置参数。Tenant 可配置启用/关闭。
- **MFASecret**: MFA 密钥存储，包含用户 ID、密钥、备份码、启用时间。
- **Invitation**: 用户邀请记录，包含 tenantId（邀请链接携带 Tenant 上下文）、邀请 Token、邮箱、过期时间、状态（已使用/已过期/已撤销）。
- **AuditEvent**: 审计事件，包含租户 ID、操作者 ID、操作类型、资源类型、结果、IP 地址、User Agent、Trace ID、时间戳。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户可通过邮箱密码完成登录，登录成功率达到 100%
- **SC-002**: SSO 域名识别响应时间 P95 ≤ 500ms
- **SC-003**: 待审核用户登录后仅能访问个人设置页，权限拦截率达到 100%
- **SC-004**: 密码强度不足时拒绝率达到 100%
- **SC-005**: MFA (TOTP) 验证成功率达到 100%
- **SC-006**: 用户邀请链接在有效期内可正常激活，过期后拒绝率达到 100%
- **SC-007**: 登录/登出事件审计日志覆盖率达到 100%
- **SC-008**: 跨租户数据访问拦截率达到 100%
- **SC-009**: 失败登录达到阈值（默认 5 次）后账号锁定（默认 30 分钟），锁定率达到 100%，阈值和时长可由 Tenant Admin 配置
- **SC-010**: 多群组权限合并逻辑正确性达到 100%
- **SC-011**: Manager 权限仅在其绑定群组内生效，边界正确性达到 100%
- **SC-012**: Access Token 和 Refresh Token 有效期由 better-auth 默认策略确定（推荐值：Access Token 15 分钟，Refresh Token 7 天）
- **SC-013**: 多租户用户切换 Tenant/Workspace 后，数据和权限正确性达到 100%
- **SC-014**: 邀请链接携带正确的 Tenant 上下文，用户通过邀请进入系统后归属到正确的租户

### Performance Targets

- **SC-101**: 登录请求响应时间 P95 ≤ 500ms
- **SC-102**: 注册请求响应时间 P95 ≤ 1s
- **SC-103**: 权限判定响应时间 P95 ≤ 50ms
- **SC-104**: SSO 域名识别响应时间 P95 ≤ 500ms
- **SC-105**: 审计日志写入延迟 ≤ 5s

### Security & Compliance

- **SC-201**: 密码不得以明文存储，必须使用哈希算法加密
- **SC-202**: 敏感操作（登录、状态变更、授权变更）必须记录审计日志
- **SC-203**: 跨租户数据访问必须被拒绝并记录异常审计事件
- **SC-204**: MFA 密钥必须加密存储
- **SC-205**: 邀请 Token 必须有有效期且过期后不可用

---

*本文档基于 .specify/templates/spec-template.md 生成*
