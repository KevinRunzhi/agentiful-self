# Tasks: Multi-Tenant Authentication Base (S1-1)

**Input**: Design documents from `/specs/1-multi-tenant-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Constitution**: 符合 `.specify.specify/memory/constitution.md` 原则

**Tests**: Tests are NOT included in this task list (not explicitly requested in spec).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story (切片驱动开发原则).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `apps/web/src/`
- **Backend**: `apps/api/src/`
- **Shared packages**: `packages/{name}/src/`
- **Database**: `packages/db/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Monorepo structure setup

- [X] T001 Create monorepo structure with pnpm workspace configuration in package.json and pnpm-workspace.yaml
- [X] T002 [P] Initialize apps/web with Next.js 16 and React 19 in apps/web/package.json
- [X] T003 [P] Initialize apps/api with Fastify 5.x in apps/api/package.json
- [X] T004 [P] Initialize packages/shared for shared TypeScript types in packages/shared/package.json
- [X] T005 [P] Initialize packages/db for Drizzle ORM schemas in packages/db/package.json
- [X] T006 [P] Initialize packages/ui for shadcn/ui components in packages/ui/package.json
- [X] T007 [P] Configure TypeScript strict mode for all packages in tsconfig.base.json
- [X] T008 [P] Configure Tailwind CSS v4 in apps/web/tailwind.config.ts
- [X] T009 [P] Setup Oxlint + ESLint configuration in .eslintrc.js and .oxlintrc.js
- [X] T010 [P] Configure environment variable templates in .env.example, apps/api/.env.example, apps/web/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Layer

- [X] T011 Setup PostgreSQL 18 connection in packages/db/src/client.ts
- [X] T012 [P] Create Tenant schema in packages/db/src/schema/tenant.ts
- [X] T013 [P] Create User schema in packages/db/src/schema/user.ts
- [X] T014 [P] Create UserRole schema in packages/db/src/schema/user-role.ts
- [X] T015 [P] Create Session schema (better-auth extension) in packages/db/src/schema/session.ts
- [X] T016 [P] Create AuditEvent schema in packages/db/src/schema/audit-event.ts
- [X] T017 Generate and run initial database migration in packages/db/src/migrations/0001_initial.sql

### Shared Types

- [X] T018 [P] Create shared auth types in packages/shared/src/types/auth.ts
- [X] T019 [P] Create shared user types in packages/shared/src/types/user.ts
- [X] T020 [P] Create shared tenant types in packages/shared/src/types/tenant.ts
- [X] T021 [P] Create shared audit types in packages/shared/src/types/audit.ts

### Backend Infrastructure

- [X] T022 Setup Fastify app base structure in apps/api/src/app.ts
- [X] T023 [P] Configure OpenTelemetry tracing plugin in apps/api/src/plugins/tracing.plugin.ts
- [X] T024 [P] Configure CORS plugin in apps/api/src/plugins/cors.plugin.ts
- [X] T025 [P] Configure helmet security headers in apps/api/src/plugins/helmet.plugin.ts
- [X] T026 [P] Configure rate limiting with Redis backend in apps/api/src/plugins/rate-limit.plugin.ts
- [X] T027 Setup Pino structured logging in apps/api/src/lib/logger.ts
- [X] T028 [P] Setup Trace ID propagation middleware in apps/api/src/middleware/trace.middleware.ts
- [X] T029 [P] Setup tenant context middleware in apps/api/src/middleware/tenant.middleware.ts

### better-auth Setup

- [X] T030 Install and configure better-auth with Drizzle adapter in apps/api/src/modules/auth/auth.config.ts
- [X] T031 [P] Configure better-auth email/password authentication in apps/api/src/modules/auth/config/email-password.config.ts
- [X] T032 [P] Configure better-auth session management (15min access, 7day refresh) in apps/api/src/modules/auth/config/session.config.ts
- [X] T033 Create better-auth API routes in apps/api/src/modules/auth/routes/auth.routes.ts

### Frontend Infrastructure

- [X] T034 [P] Setup API client with fetch in apps/web/src/lib/api-client.ts
- [X] T035 [P] Setup Zustand auth store in apps/web/src/features/auth/stores/authStore.ts
- [X] T036 [P] Create better-auth React client in apps/web/src/lib/auth-client.ts
- [X] T037 [P] Setup base UI components from shadcn/ui in apps/web/src/components/ui/
- [X] T038 [P] Setup internationalization with next-intl in apps/web/src/lib/intl.ts

### Audit Service Foundation

- [X] T039 Create audit service in apps/api/src/modules/auth/services/audit.service.ts
- [X] T040 [P] Add audit middleware for auto-logging auth events in apps/api/src/middleware/audit.middleware.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 邀请链接登录与多租户隔离 (Priority: P1) 🎯 MVP

**Goal**: 用户通过邀请链接设置密码后登录系统，支持多租户用户切换租户上下文，确保租户间数据完全隔离

**Independent Test**:
1. 创建 Tenant 和 Tenant Admin
2. Tenant Admin 邀请用户 → 用户收到邮件点击链接 → 设置密码
3. 用户登录 → 选择 Tenant/Workspace → 验证租户隔离

### Backend Models

- [X] T041 [P] [US1] Create Invitation schema in packages/db/src/schema/invitation.ts
- [X] T042 [P] [US1] Create PasswordHistory schema in packages/db/src/schema/password-history.ts
- [X] T042a [P] [US1] Create Group schema in packages/db/src/schema/group.ts (dependency for invitations)
- [X] T043 [US1] Generate migration for invitations and password history in packages/db/src/migrations/0002_invitations.sql

### Backend Repositories

- [X] T044 [P] [US1] Create user repository in apps/api/src/modules/auth/repositories/user.repository.ts
- [X] T045 [P] [US1] Create tenant repository in apps/api/src/modules/auth/repositories/tenant.repository.ts
- [X] T046 [US1] Create invitation repository in apps/api/src/modules/auth/repositories/invitation.repository.ts
- [X] T046a [P] [US1] Create user-role repository in apps/api/src/modules/auth/repositories/user-role.repository.ts

### Backend Services

- [X] T047 [US1] Implement password validation service in apps/api/src/modules/auth/services/password-policy.service.ts
- [X] T048 [US1] Implement password hashing with bcrypt in apps/api/src/modules/auth/services/password.service.ts
- [X] T049 [US1] Implement invitation token generation and validation in apps/api/src/modules/auth/services/invitation.service.ts
- [X] T050 [US1] Implement login service with email/password in apps/api/src/modules/auth/services/auth.service.ts
- [X] T051 [US1] Implement tenant switch service in apps/api/src/modules/auth/services/tenant.service.ts
- [X] T052 [US1] Implement account lockout with Redis in apps/api/src/modules/auth/services/account-lockout.service.ts

### Backend Controllers

- [X] T053 [P] [US1] Create auth controller in apps/api/src/modules/auth/controllers/auth.controller.ts
- [X] T054 [P] [US1] Create tenant controller in apps/api/src/modules/auth/controllers/tenant.controller.ts

### Backend Routes

- [X] T055 [US1] Register auth routes in apps/api/src/modules/auth/routes/index.ts
- [X] T056 [US1] Register tenant routes in apps/api/src/modules/auth/routes/index.ts

### Frontend Components

- [X] T057 [P] [US1] Create LoginForm component in apps/web/src/features/auth/components/LoginForm.tsx
- [X] T058 [P] [US1] Create InviteAcceptForm component in apps/web/src/features/auth/components/InviteAcceptForm.tsx
- [X] T059 [P] [US1] Create TenantSelector component in apps/web/src/features/auth/components/TenantSelector.tsx
- [X] T060 [P] [US1] Create PasswordResetForm component in apps/web/src/features/auth/components/PasswordResetForm.tsx

### Frontend Hooks & Services

- [X] T061 [P] [US1] Create useAuth hook in apps/web/src/features/auth/hooks/useAuth.ts
- [X] T062 [P] [US1] Create useTenant hook in apps/web/src/features/auth/hooks/useTenant.ts
- [X] T063 [P] [US1] Create auth API service in apps/web/src/features/auth/services/authApi.ts

### Frontend Pages

- [X] T064 [US1] Create login page in apps/web/src/app/(auth)/login/page.tsx
- [X] T065 [US1] Create invite accept page in apps/web/src/app/(auth)/invite/[token]/page.tsx
- [X] T066 [US1] Create password reset page in apps/web/src/app/(auth)/reset-password/page.tsx

### Email Integration

- [X] T067 [US1] Setup Resend email service in apps/api/src/lib/email.service.ts
- [X] T068 [US1] Create invitation email template in apps/api/src/modules/auth/templates/invite-email.ts

**Checkpoint**: ✅ User Story 1 complete - Users can log in via invite links with multi-tenant isolation (MVP Ready!)

---

## Phase 4: User Story 2 - 群组组织与成员管理 (Priority: P1)

**Goal**: Tenant Admin 创建群组并添加成员，用户可在多个群组中担任不同角色，Manager 权限仅在其群组内生效

**Independent Test**:
1. Tenant Admin 已登录
2. 创建新群组 → 添加成员 → 指派 Manager
3. Manager 查看群组成员 → 移除成员 → 验证权限边界

### Backend Models

- [X] T069 [P] [US2] Create Group schema in packages/db/src/schema/group.ts
- [X] T070 [P] [US2] Create GroupMember schema in packages/db/src/schema/group-member.ts
- [X] T071 [US2] Generate migration for groups in packages/db/src/migrations/0003_groups.sql

### Backend Repositories

- [X] T072 [P] [US2] Create group repository in apps/api/src/modules/group/repositories/group.repository.ts
- [X] T073 [US2] Create group member repository in apps/api/src/modules/group/repositories/group-member.repository.ts

### Backend Services

- [X] T074 [US2] Implement group CRUD service in apps/api/src/modules/group/services/group.service.ts
- [X] T075 [US2] Implement group member management service in apps/api/src/modules/group/services/group-member.service.ts
- [X] T076 [US2] Implement manager permission check service in apps/api/src/modules/group/services/permission.service.ts

### Backend Controllers & Routes

- [X] T077 [P] [US2] Create group controller in apps/api/src/modules/group/controllers/group.controller.ts
- [X] T078 [US2] Register group routes in apps/api/src/modules/group/routes/index.ts

### Frontend Components

- [X] T079 [P] [US2] Create GroupForm component in apps/web/src/features/group/components/GroupForm.tsx
- [X] T080 [P] [US2] Create GroupMemberList component in apps/web/src/features/group/components/GroupMemberList.tsx
- [X] T081 [P] [US2] Create AddMemberDialog component in apps/web/src/features/group/components/AddMemberDialog.tsx

### Frontend Hooks & Services

- [X] T082 [P] [US2] Create useGroups hook in apps/web/src/features/group/hooks/useGroups.ts
- [X] T083 [P] [US2] Create group API service in apps/web/src/features/group/api/groupApi.ts

### Frontend Pages

- [X] T084 [US2] Create groups list page in apps/web/src/app/(main)/groups/page.tsx
- [X] T085 [US2] Create group detail page in apps/web/src/app/(main)/groups/[groupId]/page.tsx

**Checkpoint**: ✅ User Story 2 complete - Groups and members can be managed with proper permission boundaries

---

## Phase 5: User Story 3 - SSO 自动识别与 JIT 入驻 (Priority: P2)

**Goal**: 用户输入企业邮箱后系统自动识别 SSO 配置，SSO 登录时自动创建账号并激活

**Independent Test**:
1. 配置 Tenant 的 SSO（邮箱域名映射）
2. 用户输入企业邮箱 → 系统推荐 SSO 登录
3. 完成 SSO 认证 → 系统自动创建账号并激活

### Backend Models

- [X] T086 [P] [US3] Create SSOConfig schema in packages/db/src/schema/sso-config.ts
- [X] T087 [US3] Generate migration for SSO config in packages/db/src/migrations/0004_sso.sql

### Backend Repositories & Services

- [X] T088 [P] [US3] Create SSO config repository in apps/api/src/modules/sso/repositories/sso.repository.ts
- [X] T089 [US3] Implement SSO domain detection service with Redis cache in apps/api/src/modules/sso/services/sso-detection.service.ts
- [X] T090 [US3] Implement better-auth OAuth2 integration in apps/api/src/modules/auth/config/oauth.config.ts
- [X] T091 [US3] Implement JIT user provisioning service in apps/api/src/modules/sso/services/jit-provisioning.service.ts

### Backend Controllers & Routes

- [X] T092 [P] [US3] Create SSO controller in apps/api/src/modules/sso/controllers/sso.controller.ts
- [X] T093 [US3] Register SSO routes in apps/api/src/modules/sso/routes/index.ts

### Frontend Components

- [X] T094 [P] [US3] Create SSOButton component in apps/web/src/features/auth/components/SSOButton.tsx
- [X] T095 [US3] Create SSOProviderList component in apps/web/src/features/auth/components/SSOProviderList.tsx

### Frontend Hooks & Services

- [X] T096 [P] [US3] Create useSSO hook in apps/web/src/features/auth/hooks/useSSO.ts
- [X] T097 [US3] Create SSO API service in apps/web/src/features/auth/services/ssoApi.ts

**Checkpoint**: ✅ User Story 3 complete - SSO detection and JIT provisioning working

---

## Phase 6: User Story 4 - 用户审核与状态管理 (Priority: P2)

**Goal**: Tenant Admin 配置用户审核，待审核用户仅能访问个人设置页，支持审批/拒绝/暂停操作

**Independent Test**:
1. Tenant Admin 开启审核 → 用户通过邀请加入进入待审核
2. 待审核用户尝试登录 → 仅能访问个人设置页
3. Tenant Admin 审批通过/拒绝 → 用户状态更新

### Backend Services

- [X] T098 [US4] Implement user status management service in apps/api/src/modules/user/services/user-status.service.ts
- [X] T099 [US4] Implement approval workflow service in apps/api/src/modules/user/services/approval.service.ts
- [X] T100 [US4] Extend login service to check user approval status in apps/api/src/modules/auth/services/auth.service.ts

### Backend Controllers & Routes

- [X] T101 [P] [US4] Create user controller in apps/api/src/modules/user/controllers/user.controller.ts
- [X] T102 [US4] Register user routes in apps/api/src/modules/user/routes/index.ts

### Frontend Components

- [X] T103 [P] [US4] Create PendingUserBanner component in apps/web/src/features/user/components/PendingUserBanner.tsx
- [X] T104 [P] [US4] Create UserApprovalList component in apps/web/src/features/admin/components/UserApprovalList.tsx
- [X] T105 [P] [US4] Create UserProfileForm component in apps/web/src/features/user/components/UserProfileForm.tsx

### Frontend Hooks & Services

- [X] T106 [P] [US4] Create useUserApproval hook in apps/web/src/features/admin/hooks/useUserApproval.ts
- [X] T107 [US4] Create user API service in apps/web/src/features/user/services/userApi.ts

### Frontend Pages

- [X] T108 [US4] Create approval queue page in apps/web/src/app/(admin)/approvals/page.tsx
- [X] T109 [US4] Create user profile page in apps/web/src/app/(main)/profile/page.tsx

**Checkpoint**: ✅ User Story 4 complete - User approval workflow and status management working

---

## Phase 7: User Story 5 - MFA 多因素认证 (Priority: P3)

**Goal**: 用户可启用 TOTP 多因素认证，租户可配置 MFA 策略，管理员可强制用户启用 MFA

**Independent Test**:
1. 用户在安全设置中启用 TOTP → 绑定认证器应用
2. 下次登录时输入验证码 → 验证通过后成功登录
3. Tenant Admin 强制用户启用 MFA → 生效

### Backend Models

- [X] T110 [P] [US5] Create MFASecret schema in packages/db/src/schema/mfa-secret.ts
- [X] T111 [US5] Generate migration for MFA in packages/db/src/migrations/0005_mfa.sql

### Backend Services

- [X] T112 [US5] Install otplib and implement TOTP generation in apps/api/src/modules/mfa/services/totp.service.ts
- [X] T113 [US5] Implement MFA secret encryption service in apps/api/src/modules/mfa/services/mfa-encryption.service.ts
- [X] T114 [US5] Configure better-auth two-factor plugin in apps/api/src/modules/auth/config/mfa.config.ts
- [X] T115 [US5] Implement tenant-level MFA policy service in apps/api/src/modules/mfa/services/mfa-policy.service.ts

### Backend Controllers & Routes

- [X] T116 [P] [US5] Create MFA controller in apps/api/src/modules/mfa/controllers/mfa.controller.ts
- [X] T117 [US5] Register MFA routes in apps/api/src/modules/mfa/routes/index.ts

### Frontend Components

- [X] T118 [P] [US5] Create MFASetupForm component in apps/web/src/features/auth/components/MFASetupForm.tsx
- [T119 [US5] Create MFALoginForm component in apps/web/src/features/auth/components/MFALoginForm.tsx

### Frontend Hooks & Services

- [X] T120 [P] [US5] Create useMFA hook in apps/web/src/features/auth/hooks/useMFA.ts
- [X] T121 [US5] Create MFA API service in apps/web/src/features/auth/services/mfaApi.ts

### Frontend Pages

- [X] T122 [US5] Create MFA setup page in apps/web/src/app/(main)/settings/security/mfa/page.tsx

**Checkpoint**: ✅ User Story 5 complete - MFA with TOTP working

---

## Phase 8: User Story 6 - 用户资料与邀请增强 (Priority: P3)

**Goal**: 用户管理个人资料（头像、昵称、语言、时区、主题），Tenant Admin 邀请功能增强

**Independent Test**:
1. 用户修改头像/昵称/语言偏好 → 更新立即生效
2. Tenant Admin 发送邀请邮件 → 用户点击链接设置密码 → 自动激活跳过审核
3. 用户点击过期链接 → 系统提示链接已过期

### Backend Services

- [X] T123 [US6] Implement user profile update service in apps/api/src/modules/user/services/user-profile.service.ts
- [X] T124 [US6] Extend invitation service with auto-activation in apps/api/src/modules/auth/services/invitation.service.ts
- [X] T125 [US6] Implement invitation expiry check in apps/api/src/modules/auth/services/invitation.service.ts

### Frontend Components

- [X] T126 [P] [US6] Create UserProfileEditor component in apps/web/src/features/user/components/UserProfileEditor.tsx
- [X] T127 [P] [US6] Create InviteUserForm component in apps/web/src/features/admin/components/InviteUserForm.tsx
- [X] T128 [P] [US6] Create ThemeSelector component in apps/web/src/features/user/components/ThemeSelector.tsx

### Frontend Pages

- [X] T129 [US6] Create settings page in apps/web/src/app/(main)/settings/page.tsx
- [X] T130 [US6] Create invite users page in apps/web/src/app/(admin)/users/invite/page.tsx

**Checkpoint**: ✅ User Story 6 complete - User profile and enhanced invitation features working

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Documentation

- [X] T131 [P] Update API documentation in docs/api/
- [X] T132 [P] Update architecture documentation in docs/architecture/
- [X] T133 [P] Create deployment guide in docs/deployment/

### Testing

- [X] T134 [P] Create E2E test for login flow in apps/web/e2e/login.spec.ts
- [X] T135 [P] Create E2E test for multi-tenant switch in apps/web/e2e/tenant-switch.spec.ts
- [X] T136 [P] Create integration test for group permissions in apps/api/tests/integration/group-permissions.test.ts

### Security & Performance

- [X] T137 Add rate limiting to sensitive endpoints in apps/api/src/plugins/rate-limit.plugin.ts
- [T138] Implement session cleanup job in apps/worker/src/processors/session-cleanup.processor.ts
- [X] T139 Add database connection pooling in packages/db/src/client.ts
- [X] T140 [P] Add security headers configuration in apps/api/src/plugins/helmet.plugin.ts

### Quality Assurance

- [X] T141 Run quickstart.md validation and fix any issues
- [X] T142 [P] Verify all Constitution Check items pass
- [X] T143 Performance test login endpoint (target P95 ≤ 500ms)
- [X] T144 Verify cross-tenant data access is blocked

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - MVP SCOPE
  - User Story 2 (P1): Can start after Foundational - no dependency on US1
  - User Story 3 (P2): Can start after Foundational - no dependency on US1/US2
  - User Story 4 (P2): Can start after Foundational - no dependency on US1/US2/US3
  - User Story 5 (P3): Can start after Foundational - no dependency on US1-US4
  - User Story 6 (P3): Can start after Foundational - no dependency on US1-US5
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

All user stories are **INDEPENDENT** after the Foundational phase:
- Each story can be implemented in parallel by different team members
- Each story has its own models, services, controllers, routes, components
- Each story is independently testable
- No story blocks another story

### Within Each User Story

1. Schema/migration → Repository → Service → Controller → Routes → Frontend
2. Parallel tasks marked [P] within a story can run simultaneously
3. Backend should be functional before frontend integration

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- All package initialization tasks (T002-T006) can run in parallel
- All configuration tasks (T007-T010) can run in parallel

**Foundational Phase (Phase 2)**:
- All schema creation tasks (T012-T016) can run in parallel
- All shared type tasks (T018-T021) can run in parallel
- All plugin configurations (T023-T026) can run in parallel
- All frontend infrastructure (T034-T037) can run in parallel

**User Stories**:
- Once Foundational phase completes, ALL user stories can be worked on in parallel
- Within each story, tasks marked [P] can run in parallel

**Polish Phase (Phase 9)**:
- All documentation tasks (T131-T133) can run in parallel
- All E2E test tasks (T134-T136) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all schema tasks for User Story 1 together:
Task T041: "Create Invitation schema in packages/db/src/schema/invitation.ts"
Task T042: "Create PasswordHistory schema in packages/db/src/schema/password-history.ts"

# Launch all repository tasks for User Story 1 together:
Task T044: "Create user repository in apps/api/src/modules/auth/repositories/user.repository.ts"
Task T045: "Create tenant repository in apps/api/src/modules/auth/repositories/tenant.repository.ts"
Task T046: "Create invitation repository in apps/api/src/modules/auth/repositories/invitation.repository.ts"

# Launch all frontend components for User Story 1 together:
Task T057: "Create LoginForm component in apps/web/src/features/auth/components/LoginForm.tsx"
Task T058: "Create InviteAcceptForm component in apps/web/src/features/auth/components/InviteAcceptForm.tsx"
Task T059: "Create TenantSelector component in apps/web/src/features/auth/components/TenantSelector.tsx"
Task T060: "Create PasswordResetForm component in apps/web/src/features/auth/components/PasswordResetForm.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) 🎯

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Foundational (T011-T040) - CRITICAL
3. Complete Phase 3: User Story 1 (T041-T068)
4. **STOP and VALIDATE**: Test invite link login flow
5. Deploy/demo if ready

**MVP delivers**: Users can log in via invite links with multi-tenant isolation

### Incremental Delivery

1. **Foundation**: Setup + Foundational → Base infrastructure ready
2. **MVP**: Add User Story 1 → Invite login working → Deploy/Demo
3. **Group Management**: Add User Story 2 → Groups working → Deploy/Demo
4. **SSO**: Add User Story 3 → SSO login working → Deploy/Demo
5. **Approval**: Add User Story 4 → User approval working → Deploy/Demo
6. **MFA**: Add User Story 5 → MFA working → Deploy/Demo
7. **Profile**: Add User Story 6 → Profile management working → Deploy/Demo

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With 3 developers after Foundational phase:

1. **Developer A**: User Story 1 (Invite Login) - Phase 3
2. **Developer B**: User Story 2 (Groups) - Phase 4
3. **Developer C**: User Story 3 (SSO) - Phase 5

Then:
1. **Developer A**: User Story 4 (Approval) - Phase 6
2. **Developer B**: User Story 5 (MFA) - Phase 7
3. **Developer C**: User Story 6 (Profile) - Phase 8

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | 10 | Project initialization and configuration |
| Phase 2: Foundational | 30 | Database, shared types, backend/ frontend infrastructure |
| Phase 3: US1 - Invite Login | 28 | Multi-tenant invite login flow (MVP) |
| Phase 4: US2 - Groups | 17 | Group and member management |
| Phase 5: US3 - SSO | 12 | SSO detection and JIT provisioning |
| Phase 6: US4 - Approval | 12 | User approval and status management |
| Phase 7: US5 - MFA | 13 | TOTP multi-factor authentication |
| Phase 8: US6 - Profile | 8 | User profile and enhanced invitations |
| Phase 9: Polish | 14 | Documentation, testing, security, QA |
| **Total** | **144** | All tasks for complete feature |

**Parallel Opportunities**: 59 tasks marked [P] can run in parallel

**MVP Scope (Phase 1-3)**: 68 tasks to deliver invite-based login with multi-tenant isolation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All tasks include exact file paths for immediate execution
