请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

以下澄清点基于对 docs/prd/PRD.md、docs/roadmap/PHASE1_BACKLOG.md、docs/tech/data-model/DOMAIN_MODEL_P1.md、docs/feature-list/feature-list.json、docs/tech/TECHNOLOGY_STACK.md 的完整阅读得出。

---

## 一、用户-租户关系模型（高影响）

### Q1. 用户-租户绑定模型
**问题**：用户与 Tenant 是 1:1 还是 N:N？
**答案**：**N:N**。User 表无 tenantId 字段，通过 GroupMember → Group（tenantId）→ Tenant 间接关联。UserRole 表也有 tenantId，同一用户可在不同 Tenant 拥有不同角色。登录后若用户属于多个 Tenant，需提供 Tenant/Workspace 选择器。
**Spec 更新**：在 US1 中补充"多 Tenant 用户登录后展示 Workspace 选择器"场景。

### Q2. 自注册的 Tenant 归属
**问题**：用户自注册时如何确定归属哪个 Tenant？
**答案**：**不支持无上下文自注册**。用户进入 Tenant 只有 3 条路径：(1) 邀请链接（F-AUTH-008，链接绑定 Tenant），(2) SSO 登录（F-AUTH-002/003，邮箱域名匹配 Tenant），(3) Tenant Admin 后台手动添加。不存在开放的无 Tenant 上下文注册入口。
**Spec 更新**：修正 FR-020 为"通过邀请链接或 Tenant 专属注册入口注册的用户进入待审核状态（如 Tenant 开启审核）"。删除或修正所有提到"用户自注册"时未携带 Tenant 上下文的描述。

### Q10. User.email 全局唯一
**问题**：email UNIQUE 约束在多 Tenant 场景下的含义？
**答案**：**一个邮箱 = 一个 User 实体 = 可关联多个 Tenant**。Domain Model 中 User.email 为全局 UNIQUE，这意味着同一邮箱的用户在整个系统中只有一条 User 记录，通过 GroupMember 关联到不同 Tenant。与 better-auth 的默认行为一致。
**Spec 更新**：在 Key Entities 的 User 描述中补充"同一邮箱在系统中全局唯一，可通过群组关联到多个 Tenant"。

### Q11. 已存在用户被邀请到新 Tenant
**问题**：如果邮箱已存在一个 User（属于 Tenant A），Tenant B 的 Admin 邀请同一邮箱，会发生什么？
**答案**：**关联现有 User 到新 Tenant**。不创建新 User 记录，而是为已有 User 建立到 Tenant B 的 GroupMember 关联。用户点击邀请链接后无需重新设置密码（已有密码），直接激活在 Tenant B 的身份。
**Spec 更新**：在 US6 中补充"邀请已存在用户到新 Tenant"的 Acceptance Scenario。FR-031 改为"系统 MUST 要求新用户点击链接后设置密码；已有账号用户直接激活在新 Tenant 的身份"。

### Q12. 多 Tenant 切换行为
**问题**：用户切换 Tenant 时是否需要重新认证？
**答案**：**不需要重新认证，仅切换上下文**。用户已通过认证，切换 Tenant 只是变更当前工作的 Tenant 上下文（类似 Slack 的 Workspace 切换），不需要重新登录。切换后所有数据和权限按目标 Tenant 重新加载。
**Spec 更新**：在 Edge Cases 中补充"Tenant 切换为上下文切换，不触发重新认证"。

---

## 二、认证与安全策略（高影响）

### Q3. Token 策略来源
**问题**：Access Token 15 分钟 / Refresh Token 7 天是 PRD 写死还是假设？
**答案**：**Spec 生成时的行业默认假设**，PRD 和 PHASE1_BACKLOG 均未定义具体数值。这些是合理默认值，应标注为"默认值，Tenant 可配置"。
**Spec 更新**：FR-038/039 改为"系统 MUST 支持 Tenant 配置 Access Token 有效期（默认 15 分钟）和 Refresh Token 有效期（默认 7 天）"。

### Q4. 账号锁定策略
**问题**：失败 5 次锁定 30 分钟是否应 Tenant 可配？
**答案**：**是，应为 Tenant 可配置**。F-AUTH-005（密码策略）的安全参数均为 Tenant 可配，账号锁定策略应遵循同样原则（Constitution C-04：Tenant 是治理/配置的最小边界）。
**Spec 更新**：FR-043 改为"系统 MUST 支持 Tenant 配置登录失败锁定策略（默认失败 5 次后锁定 30 分钟，阈值可配 3-10 次，锁定时长可配 15-120 分钟）"。

### Q5. SSO 与密码登录共存
**问题**：Tenant 配置 SSO 后，密码登录是否仍可用？
**答案**：**共存，SSO 优先推荐但不强制**。F-AUTH-001 将所有认证方式并列，F-AUTH-002 的行为是"推荐 SSO"而非"强制 SSO"（无匹配时返回其他方式）。强制 SSO（enforce_sso）属于 v2.0 增强，不在 S1-1 范围。
**Spec 更新**：在 US3 补充"配置 SSO 后用户仍可选择邮箱密码登录"场景。

### Q9. S1-1 实际实现的认证方式范围
**问题**：F-AUTH-001 列出 9 种方式，S1-1 全部实现吗？
**答案**：**不是，S1-1 仅实现核心方式**。按 MVP 优先原则（Constitution C-02），S1-1 实现：(1) 邮箱密码（P1 核心入口），(2) OIDC/OAuth2（P2，支撑 SSO 场景所需的协议基础）。手机号/Google/GitHub/WeChat/CAS/SAML 在后续切片或 v1.x 迭代中实现。
**Spec 更新**：FR-007 改为"系统 MUST 支持用户通过邮箱和密码完成注册和登录（S1-1 范围）"，补充 FR "系统 MUST 支持 OIDC/OAuth2 协议对接外部身份提供商（S1-1 范围，作为 SSO 基础）"。在 Scope/Assumptions 中明确"其他认证方式（手机号、社交登录、CAS、SAML）不在 S1-1 范围"。

### Q8. 忘记密码自助重置
**问题**：用户忘记密码的自助重置流程缺失。
**答案**：**必须补充**。这是邮箱密码登录（F-AUTH-001）的基本保障功能。流程为：用户点击"忘记密码" → 输入邮箱 → 系统发送重置链接 → 用户点击链接设新密码（须符合密码策略）→ 密码更新成功。
**Spec 更新**：补充 FR "系统 MUST 支持用户通过邮箱验证链接自助重置密码"，补充 FR "重置密码链接有效期默认 1 小时，过期后不可用"。在 US1 中补充忘记密码的 Acceptance Scenario。

### Q13. 用户状态变更时的会话处理
**问题**：Admin 暂停或拒绝一个已登录的用户时，该用户当前会话怎么处理？
**答案**：**立即失效**。当 Tenant Admin 将用户状态从 active 改为 suspended 或 rejected 时，该用户的所有活跃会话（Access Token + Refresh Token）必须立即失效，用户在下一次请求时被强制登出。这是安全边界要求。
**Spec 更新**：补充 FR "系统 MUST 在用户状态变更为暂停或拒绝时，立即撤销该用户的所有活跃会话"。在 Edge Cases 中补充此场景。

### Q14. 登录端点的速率限制
**问题**：登录/注册接口是否有速率限制？
**答案**：**需要**。登录接口是暴力破解攻击的首要目标。应对 /auth/* 端点实施速率限制：(1) 单 IP 限制每分钟 30 次登录请求，(2) 单邮箱限制每分钟 10 次登录请求。超限返回 429 状态码。
**Spec 更新**：补充 FR "系统 MUST 对认证端点实施速率限制（单 IP 30 次/分钟，单邮箱 10 次/分钟），超限返回 429 状态码"。

---

## 三、组织与群组（中影响）

### Q6. Tenant 创建流程
**问题**：v1.0 谁创建 Tenant？
**答案**：**v1.0 通过种子数据或部署脚本预创建**。ROOT ADMIN 默认关闭（F-IAM-001），Tenant 生命周期管理属于 S1-4 平台管理切片，不在 S1-1 范围。S1-1 假设 Tenant 已存在。
**Spec 更新**：在 Assumptions 或 Dependencies 章节补充"S1-1 假设至少一个 Tenant 已通过种子数据创建"。

### Q7. 默认 Group
**问题**：新 Tenant 是否自动创建默认 Group？新用户是否自动加入？
**答案**：**是**。Group 是应用授权和配额分配的必要单元（F-ORG-002），用户不属于任何 Group 则无法获得应用访问权限（F-IAM-003）。Tenant 创建时应自动生成 Default Group，新成员默认加入。
**Spec 更新**：补充 FR "系统 MUST 在 Tenant 初始化时自动创建一个 Default Group"，补充 FR "系统 MUST 将新加入 Tenant 的用户自动添加到 Default Group"。

### Q15. 群组成员管理权限
**问题**：谁可以添加/移除群组成员？只有 Tenant Admin 还是 Manager 也可以？
**答案**：**Tenant Admin 和 Manager 均可**，但范围不同。Tenant Admin 可以管理所有 Group 的成员。Manager 只能管理其担任 Manager 角色的 Group 的成员（F-ORG-003："Manager 权限仅在其绑定 Group 内生效"）。但注意：RBAC 权限判定的详细逻辑属于 S1-2 切片，S1-1 仅建立 GroupMember 的数据关联。
**Spec 更新**：补充 FR "系统 MUST 支持 Tenant Admin 管理任意群组的成员，Manager 管理其所属群组的成员"。在 Edge Cases 补充"Manager 尝试管理非其所属群组时被拒绝"。

---

## 四、用户状态与数据模型（中影响）

### Q16. 用户状态枚举不一致
**问题**：Domain Model 定义 User.status 为 "active / pending / banned"（3 个），Spec 定义为"活跃/暂停/待审核/已拒绝"（4 个），F-AUTH-004 notes 说"待审核/活跃/暂停/拒绝"（4 个）。哪个是权威？
**答案**：**F-AUTH-004 的 4 个状态为权威**：active（活跃）、pending（待审核）、suspended（暂停）、rejected（已拒绝）。Domain Model 中的 "banned" 应视为草稿版本的不准确描述，以 Feature 定义为准。
**Spec 更新**：确认 Key Entities 中 UserStatus 为 4 个状态。建议 Spec 中添加状态转换图。

### Q17. 用户状态转换规则
**问题**：状态之间哪些转换是合法的？例如 rejected 用户能否被重新激活？
**答案**：合法转换为：
- pending → active（Admin 批准）
- pending → rejected（Admin 拒绝）
- active → suspended（Admin 暂停）
- suspended → active（Admin 恢复）
- rejected → pending（Admin 重新开放审核，可选）
禁止转换：active → rejected（应先暂停再拒绝）、任何状态 → pending（pending 仅在注册时产生，无法手动设回）。
**Spec 更新**：补充一个 UserStatus 状态转换矩阵或状态流程图。

---

## 五、外部依赖与集成（中影响）

### Q18. 邮件服务依赖
**问题**：邀请链接（F-AUTH-008）和密码重置都需要发邮件，邮件服务是外部依赖还是内建？邮件发送失败怎么处理？
**答案**：**外部依赖**。通过 SMTP 或第三方邮件服务（如 Resend、SendGrid）发送事务性邮件。邮件发送失败时：(1) 重试 3 次（间隔递增），(2) 仍失败则记录审计日志并通知 Admin，(3) 用户侧提示"邮件发送失败，请稍后重试或联系管理员"。邮件模板支持 Tenant 品牌定制（logo、颜色）。
**Spec 更新**：补充 Dependencies/Assumptions 章节"邮件发送依赖外部 SMTP 或邮件服务商"。补充 FR "系统 MUST 在邮件发送失败时重试最多 3 次，仍失败则记录审计日志并提示用户"。

### Q19. better-auth 与 User 表的关系
**问题**：TECHNOLOGY_STACK.md 提到使用 better-auth，Domain Model 备注"better-auth 会自动创建 accounts、sessions、verifications 等认证相关表，此处 User 为业务用户表"。两者如何关联？
**答案**：**User 是业务表，better-auth 有自己的认证表**。better-auth 自动管理 accounts（OAuth 账号）、sessions（会话）、verifications（验证码/链接）等表。业务 User 表通过共享 user.id 与 better-auth 的 user 表关联。这是 plan 阶段需要处理的实现细节，但 Spec 应明确"认证流程由 better-auth 管理，业务用户数据在 User 表"这一边界。
**Spec 更新**：在 Assumptions/Dependencies 补充"认证流程（会话、Token、OAuth）由 better-auth 库管理，S1-1 不重复实现认证基础设施"。

---

## 六、UX 与国际化（低影响）

### Q20. 登录页面形态
**问题**：是全局统一登录页，还是每个 Tenant 有独立品牌的登录页？
**答案**：**全局统一登录页 + Tenant 品牌渲染**。用户访问统一登录 URL，输入邮箱后系统识别 Tenant（通过 SSO 域名匹配或邀请链接上下文）。如果 Tenant 有品牌配置（logo、主题色），登录页动态渲染 Tenant 品牌。v1.0 暂不支持 Tenant 独立子域名（如 tenant.app.com），这是 v2.0 范围。
**Spec 更新**：在 US1 补充"登录页为统一入口，根据 Tenant 品牌配置动态渲染"。在 Scope 明确"v1.0 不支持 Tenant 独立子域名登录"。

### Q21. i18n 实现范围
**问题**：F-AUTH-007 提到语言偏好，S1-1 需要实现完整的多语言切换吗？
**答案**：**S1-1 仅实现语言偏好存储和切换基础设施**，不要求所有界面文案的完整翻译。具体来说：(1) 用户可选择语言偏好并持久化，(2) Tenant 可配置默认语言，(3) 前端框架加载对应语言包（i18n key → 翻译文本），(4) S1-1 只需提供中文和英文两个语言包，其他语言在后续迭代中补充。
**Spec 更新**：在 FR-026/027 补充"S1-1 支持中文和英文两种语言，其他语言在后续版本补充"。

---

## 七、审计与切片边界（低影响）

### Q22. FR-034~037 审计日志的切片归属
**问题**：Spec 中 FR-034~037 定义了审计日志要求，但 F-AUDIT-001（审计日志采集）不在 S1-1 的 Feature 映射中（属于 S3-2 审计合规切片）。这些 FR 是否越界？
**答案**：**部分越界但合理保留**。虽然 F-AUDIT-001 属于 S3-2，但 PHASE1_BACKLOG 的 S1-1 DoD 明确要求"审计日志覆盖登录/登出"（AC-S1-1-08）。因此 S1-1 应实现**最小审计能力**：仅记录认证相关事件（登录/登出/失败/状态变更），完整的审计查询/导出/管理界面属于 S3-2。
**Spec 更新**：在 FR-034~037 前添加注释"以下为 S1-1 最小审计要求（完整审计能力在 S3-2 切片），仅覆盖认证相关事件的写入"。

### Q23. 权限判定性能指标 SC-103 的切片归属
**问题**：SC-103 定义"权限判定响应时间 P95 ≤ 50ms"，但 RBAC 权限判定属于 S1-2 切片。S1-1 是否需要这个指标？
**答案**：**S1-1 不需要通用权限判定指标**。S1-1 中的"权限"仅指"待审核用户只能访问个人设置页"这一简单判定，不涉及 RBAC。SC-103 应移除或标注为"属于 S1-2 范围"。
**Spec 更新**：删除 SC-103 或标注"此指标属于 S1-2 RBAC 切片"。
