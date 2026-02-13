S1-1 多租户身份认证基座

## 切片概述

这是 Phase 1 的第一个切片（S1-1），零依赖，是所有后续切片的基础。目标是实现多租户身份认证的完整端到端路径：用户可以登录系统、归属到正确的租户和群组、并完成身份生命周期管理。

## 覆盖的 Feature（共 11 个）

### P1 核心功能（必须先实现）
- **F-ORG-001** 多租户隔离与治理单元：Tenant 是最高级隔离单元，Workspace 是 UI 别名，隔离覆盖用户/群组/对话/执行/统计/审计/策略
- **F-ORG-002** 群组组织与成员归属：Tenant 内 Group 组织单元，Team 是 UI 别名，单用户可加入多个 Group
- **F-ORG-003** 多群组成员与管理者绑定：同一用户可属于多个 Group 并在多个 Group 担任 Manager，Manager 权限仅在绑定 Group 内生效
- **F-AUTH-001** 多认证方式登录：支持邮箱密码/手机号/Google/GitHub/WeChat/CAS/OIDC/SAML/OAuth2
- **F-AUTH-005** 密码策略管理：默认 ≥8 位含大小写+数字，支持密码有效期 30-365 天，历史密码限制 3-12 个

### P2 企业级增强
- **F-AUTH-002** 基于邮箱域名的 SSO 自动识别：用户输入邮箱后 ≤500ms 匹配 Tenant SSO 配置，匹配成功推荐给用户点击，无匹配返回其他登录方式
- **F-AUTH-003** JIT 用户创建与入驻：SSO 场景下 Just-in-time 创建用户并完成租户内账号初始化
- **F-AUTH-004** 用户状态与审核流：状态枚举为活跃/暂停/待审核/已拒绝；邮箱/手机自注册进入待审核，SSO 用户默认自动激活；待审核用户可登录但仅访问个人设置与状态提示

### P3 可延后功能
- **F-AUTH-006** MFA（TOTP）与租户级策略：支持 TOTP 多因素认证，Tenant 可配置强制/可选/关闭，Admin 可对特定用户强制 MFA
- **F-AUTH-007** 用户资料与偏好设置：管理头像/昵称/语言/时区/主题偏好，Tenant 可配置默认语言
- **F-AUTH-008** 用户邀请与激活链接：Tenant Admin 通过邮箱邀请，发送含 Token 的激活链接，用户设置密码后自动激活（跳过审批），链接有效期默认 7 天

## 必须参考的文档

请按以下顺序阅读指定章节，不需要阅读未列出的部分：

1. **docs/roadmap/PHASE1_BACKLOG.md** → 仅读「S1-1：多租户身份认证基座」章节，提取 Feature 映射、验收映射（AC-S1-1-01~08）、接口冻结点、DoD
2. **docs/prd/PRD.md** → 仅读 §2 租户与组织模型（§2.1~2.4）和 §3 身份认证与账号体系（§3.1~3.4），提取核心规则（写死）、用户状态枚举、SSO 流程、密码策略、MFA 规则、邀请流程
3. **docs/feature-list/feature-list.json** → 仅读上述 11 个 Feature ID 的条目（F-ORG-001~003 + F-AUTH-001~008），提取 description/actors/notes
4. **docs/tech/data-model/DOMAIN_MODEL_P1.md** → 仅读 §3.1 Tenant/Group/GroupMember 和 §3.2 User 实体定义，用于填写 Key Entities
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → 仅读 S1-1 相关验收条目，用于填写 Success Criteria

## User Story 组织建议

请将 11 个 Feature 按用户旅程组织为 5-7 个 User Story，而非 1:1 映射。建议分组：

- **US1（P1）邮箱密码登录与多租户隔离**：F-ORG-001 + F-AUTH-001 + F-AUTH-005 → 用户通过邮箱密码登录并进入正确租户空间
- **US2（P1）群组组织与成员管理**：F-ORG-002 + F-ORG-003 → 用户归属群组，支持多群组与 Manager
- **US3（P2）SSO 自动识别与 JIT 入驻**：F-AUTH-002 + F-AUTH-003 → 企业用户输入邮箱后匹配 SSO 并自动初始化
- **US4（P2）用户审核与状态管理**：F-AUTH-004 → Admin 审核新用户，控制状态流转
- **US5（P3）MFA 多因素认证**：F-AUTH-006 → 用户启用 TOTP，租户强制策略
- **US6（P3）用户资料与邀请**：F-AUTH-007 + F-AUTH-008 → 用户管理资料偏好，Admin 邀请用户

以上仅供参考，可根据阅读材料调整，但必须覆盖全部 11 个 Feature。

## Edge Cases 提示

至少覆盖：并发登录、Token 过期/失效、多群组权限冲突、SSO 配置错误降级、密码策略边界、邀请链接过期

## 边界约束

- ❌ 不涉及 RBAC 权限判定（属于 S1-2 切片的 F-IAM-* 系列）
- ❌ 不涉及应用授权/配额（属于 S1-3 切片）
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
