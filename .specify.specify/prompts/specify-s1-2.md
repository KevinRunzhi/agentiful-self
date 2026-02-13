S1-2 RBAC 与授权模型

## 切片概述

这是 Phase 1 的第二个切片（S1-2），依赖 S1-1（多租户身份认证基座）。S1-1 已建立 Tenant/Group/GroupMember/User 实体和认证基础。S1-2 的目标是在此基础上实现完整的 RBAC 权限体系和应用访问授权：定义四级角色（ROOT ADMIN/Tenant Admin/Manager/User）、实现权限判定引擎（P95 ≤50ms）、建立群组→应用授权主路径、支持用户直授例外和显式拒绝优先级。

本切片完成后，系统将具备完整的"谁能做什么"的治理能力，为 S1-3 的应用入口和配额管理提供基础。

## 覆盖的 Feature（共 8 个）

### P1 核心功能（必须先实现）

- **F-IAM-001** 角色体系（RBAC）：提供 ROOT ADMIN/Tenant Admin/Manager/User 四级角色，按 Platform/Tenant/Group/User 作用域生效。ROOT ADMIN 默认关闭，需显式启用。预置角色为系统角色（isSystem=true），不可删除。
- **F-IAM-003** 应用访问授权（群组→应用）：通过 Group 为成员提供应用访问权限的主路径授权能力。仅 Tenant Admin 可执行群组→应用授权。授权/撤销即时生效并纳入审计。
- **F-IAM-005** 授权优先级与显式拒绝：提供稳定的权限判定优先级链。优先级从高到低为：Deny（显式拒绝）> 用户直授 Allow > 群组授权/Manager 用户级授权 Allow（同级）> 默认拒绝。ABAC 仅作为 Allow/Deny 附加条件，不单独产生授权。权限判定 ≤50ms。
- **F-IAM-006** 多群组权限合并与归因：访问权限按并集（OR）合并，任一群组授予即可访问。配额/扣费归因到当前工作群组。扣费群组必须是授予该 App 访问权的群组之一。选择机制：默认上次使用群组（本地持久化）、顶部导航 Group Switcher、API Header X-Active-Group-ID。单群组用户隐藏切换器。
- **F-IAM-007** 内容可见性边界：定义并强制执行对话/统计/隐私的可见范围边界。User 仅可查看自己对话。Manager 可见团队统计与用户级指标排行（仅指标），数据范围严格限制为当前 Group 上下文产生的数据，不可查看成员对话内容/摘要。Tenant Admin 查看成员对话需事由+审计。

### P2 企业级增强

- **F-IAM-002** Break-glass 紧急访问机制：支持运维紧急访问流程并强制留痕审计。需填写事由。产生最高级别审计（Severity=Critical），不可删除。系统自动向 Tenant Admin 发送站内信通知（邮件通知为 v2.0+）。访问权限仅在本次会话或 1 小时内有效。
- **F-IAM-004** 用户直授例外授权：支持对个别用户进行应用直授并设置原因与有效期。仅 Tenant Admin 可执行。需原因+有效期。默认 7 天，最长 90 天。到期自动撤销。需审计。
- **F-IAM-008** 智能上下文切换：用户可见所有有权访问的应用（并集），点击应用时系统自动或提示用户切换群组上下文。规则：若当前 Context 已授权则直接进入；若未授权且仅属一个有效群组则自动切换；若属多个有效群组则弹窗选择。

## 与 S1-1 的接口依赖

S1-2 依赖 S1-1 已实现的以下能力（不重复实现）：
- Tenant、Group、GroupMember、User 实体和 CRUD
- 用户认证和会话管理（登录/Token/MFA）
- 用户状态管理（active/pending/suspended/rejected）
- 租户数据隔离（tenant_id 上下文）
- 最小审计写入能力（认证事件）

S1-2 新增的数据实体：
- Role（角色）：系统预置角色表
- Permission（权限）：权限代码表（格式：{category}:{action}）
- RolePermission（角色-权限关联）
- UserRole（用户-角色关联，含 tenantId 作用域和 expiresAt）
- App（应用，S1-2 仅需 App 基本结构用于授权关联，完整 App 管理在 S1-3）
- AppGrant（应用授权记录：granteeType=group/user，permission=use/deny）

## 必须参考的文档

请按以下顺序阅读指定章节，不需要阅读未列出的部分：

1. **docs/roadmap/PHASE1_BACKLOG.md** → 仅读「S1-2：RBAC 与授权模型」章节，提取 Feature 映射、验收映射（AC-S1-2-01~08）、接口冻结点、DoD
2. **docs/prd/PRD.md** → 仅读 §4 权限与治理模型（§4.1~4.3），重点：
   - §4.2.1 角色定义（四级角色+作用域）
   - §4.2.3 授权模型（授权来源、优先级链、ABAC）
   - §4.2.4 多群组权限合并规则（并集+配额归因）
   - §4.2.4a 当前工作群组（Active Group Context，选择机制、约束、智能切换）
   - §4.2.6 内容可见性边界（User/Manager/Tenant Admin 三级可见性）
   - §4.3 验收标准
3. **docs/feature-list/feature-list.json** → 仅读 F-IAM-001~008 共 8 个 Feature 条目，提取 description/actors/notes/scope
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 仅读 §3.3 RBAC 权限（Role/Permission/RolePermission/UserRole）和 §3.4 应用与授权（App/AppGrant），用于填写 Key Entities
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → 仅读 §2.2 S1-2 验收条目（AC-S1-2-01~08 + AC-S1-2-B01~B03），用于填写 Success Criteria
6. **specs/1-multi-tenant-auth/spec.md** → 阅读 S1-1 的 spec，了解已确立的实体定义和边界约束，确保 S1-2 不重复定义且保持一致

## User Story 组织建议

请将 8 个 Feature 按用户旅程组织为 4-6 个 User Story，而非 1:1 映射。建议分组：

- **US1（P1）四级角色体系与权限判定**：F-IAM-001 + F-IAM-005 → 系统建立 ROOT ADMIN/Tenant Admin/Manager/User 角色体系，并以 Deny > 直授 > 群组 > 拒绝 的优先级链判定权限。这是整个授权系统的基础引擎。
- **US2（P1）群组→应用授权主路径**：F-IAM-003 + F-IAM-006 → Tenant Admin 将应用授权给群组，用户通过群组成员身份获得访问权限。多群组用户看到权限并集，配额归因到当前工作群组。
- **US3（P1）内容可见性边界**：F-IAM-007 → 三级可见性控制：User 只看自己、Manager 看团队统计（不看内容）、Tenant Admin 查看需事由审计。这是数据隐私的核心保障。
- **US4（P2）用户直授与例外授权**：F-IAM-004 → Tenant Admin 对个别用户进行应用直授，必须填写原因和有效期（默认7天，最长90天），到期自动撤销。
- **US5（P2）Break-glass 紧急访问**：F-IAM-002 → ROOT ADMIN 紧急访问租户数据，必须填写事由，自动通知 Tenant Admin，产生 Critical 审计，权限仅 1 小时有效。
- **US6（P2）智能上下文切换**：F-IAM-008 → 用户看到所有可用应用，点击时系统智能判断是否需要切换群组上下文，单群组自动切换，多群组弹窗选择。

以上仅供参考，可根据阅读材料调整，但必须覆盖全部 8 个 Feature。

## Edge Cases 提示

至少覆盖以下场景：
- **权限变更即时生效**：Admin 撤销群组授权后，用户正在进行的会话如何处理？（≤5s 全平台生效）
- **授权过期自动失效**：用户直授到期后，系统立即拦截，无宽限期
- **多群组权限冲突**：用户在群组 A 有 Allow，在群组 B 有 Deny，Deny 优先
- **Group Switcher 边界**：用户只属于一个群组时隐藏切换器；当前群组未授权目标应用时自动切换
- **Break-glass 时限**：ROOT ADMIN 紧急访问 1 小时后自动失效，不可续期
- **Manager 可见性边界**：Manager 只看到当前 Group 上下文的统计数据，跨 Group 的数据不可见
- **Tenant Admin 查看对话**：必须填写事由，系统记录审计，且仅在当前会话有效
- **无授权应用不可见**：用户在应用列表中完全看不到无权访问的应用（而非灰显）
- **角色降级**：Tenant Admin 将自己降级为 User，系统应有保护机制防止最后一个 Admin 降级

## 边界约束

- ❌ 不涉及应用管理 CRUD（属于 S1-3/S3-1 切片的 F-APP-* 系列，S1-2 仅需 App 基本实体用于授权关联）
- ❌ 不涉及配额管理（属于 S1-3 切片的 F-QUOTA-* 系列，S1-2 仅定义配额归因到当前工作群组的规则）
- ❌ 不涉及统计报表和仪表盘（属于 S3 Stage 切片）
- ❌ 不涉及 Manager 群组内用户级授权的完整 UI（属于 S3-1 的 F-MGR-005，S1-2 仅建立 AppGrant 模型支持 granteeType=user）
- ❌ 不重复实现 S1-1 已有的认证、用户状态、审计写入能力
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
