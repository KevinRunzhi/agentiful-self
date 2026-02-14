S3-3 平台管理与用户体验完善

## 切片概述

这是 Phase 1 Stage 3 的第三个切片（S3-3），也是 Phase 1 的最后一个切片，依赖 S3-2（审计与安全合规闭环）。S3-2 已建立完整的审计追溯、安全策略和统计报表。S3-3 的目标是补全平台管理能力和用户体验能力，使产品达到 v1.0 完整发布状态：

1. **ROOT ADMIN 平台管理**：租户生命周期管理、租户级总配额、平台全局配置
2. **系统设置**：Tenant 基础信息/品牌/多语言/Webhook/观测平台/通知/公告/文件上传/对话分享/API Key
3. **Open API**：OAuth2/OIDC + API Key 认证的平台 API
4. **Webhook**：事件订阅与投递（P95 ≤ 30s，3 次重试 ≥ 99%）
5. **国际化**：中英文切换
6. **品牌与主题**：Logo/颜色/字体定制
7. **通知系统**：站内通知中心 + 系统公告广播
8. **可靠性**：高可用/性能指标/规模容量/备份恢复

本切片完成后，AgentifUI v1.0 全部功能就位，具备生产上线条件。

## 覆盖的 Feature（共 18 个）

### ROOT ADMIN 平台管理

- **F-ADMIN-PLAT-001** 租户生命周期管理：创建/禁用/启用/删除 Tenant。创建 ≤ 30s 可用；禁用即时生效（该 Tenant 所有用户立即无法登录）。
- **F-ADMIN-PLAT-002** 租户级总配额上限配置：ROOT ADMIN 设定每个 Tenant 的 Token/次数/成本总上限。
- **F-ADMIN-PLAT-003** 平台全局配置：默认密码策略/MFA 策略/保留期/注册审批开关等全局默认值。

### 系统设置（Tenant Admin）

- **F-ADMIN-SETTINGS-001** 租户基础信息设置：name/description/contact_email。
- **F-ADMIN-SETTINGS-002** 品牌与主题设置：primary_color/secondary_color/logo/favicon/site_name。
- **F-ADMIN-SETTINGS-003** 多语言默认与用户覆盖策略：Tenant 默认语言（zh/en）+ 用户可覆盖。
- **F-ADMIN-SETTINGS-004** Webhook 配置与投递日志查看：webhook_url/subscribed_events/signing_secret/enabled + 投递日志。
- **F-ADMIN-SETTINGS-005** 外部观测平台配置：URL 模板（Grafana/Jaeger 等）+ 测试连接。
- **F-ADMIN-SETTINGS-006** 通知配置与保留期：通知类型开关 + 保留天数（默认 90 天）。
- **F-ADMIN-SETTINGS-007** 系统公告管理：创建/编辑/删除/发布 Tenant 级公告。
- **F-ADMIN-SETTINGS-008** 保留策略汇总视图：展示所有保留策略（审计日志/通知/文件/对话等）的当前配置。
- **F-ADMIN-SETTINGS-009** Tenant 级文件上传策略配置：文件大小上限/类型白名单/保留期。
- **F-ADMIN-SETTINGS-010** 对话分享策略配置：默认有效期/最长有效期/是否强制登录。
- **F-ADMIN-SETTINGS-011** API Key 管理：创建/撤销/列表 API Key，用于 Open API 认证。

### 平台能力

- **F-OPEN-001** 平台 Open API：提供 RESTful API 供外部系统集成。认证方式：OAuth2/OIDC + API Key。
- **F-OPEN-002** Webhook 事件订阅与投递：支持事件推送到外部端点。P95 ≤ 30s 首次投递；3 次重试成功率 ≥ 99%。
- **F-I18N-001** 多语言（中文/英文）：全平台中英文切换，Tenant 可配置默认语言。
- **F-BRAND-001** 主题与品牌定制：Logo/主色调/辅色/favicon/标题 Tenant 级别定制。

### 用户体验与可靠性

- **F-A11Y-001** 基础可访问性支持：键盘导航/焦点管理/ARIA 标签/对比度。
- **F-NOTIF-001** 站内通知中心：通知列表/未读标记/已读/清除。保留期 90 天。
- **F-NOTIF-002** 平台/租户系统公告广播：ROOT ADMIN 发布平台公告；Tenant Admin 发布 Tenant 公告。置顶/关闭。
- **F-UX-001** 响应式适配策略：Chat 页面支持移动端；管理后台 PC 专属。
- **F-REL-001** 高可用与无单点部署：API/Web 均支持水平扩展，无单点故障。
- **F-REL-002** 关键体验与性能指标承诺：首屏 ≤ 2s、API P95 ≤ 500ms、并发 ≥ 1000。
- **F-REL-003** 规模容量承诺：单 Tenant ≥ 5 万用户、同时在线 ≥ 1000。
- **F-REL-004** 数据备份与恢复策略：RPO ≤ 24h、RTO ≤ 4h。

## 与前置切片的接口依赖

### 依赖 S3-1/S3-2 的能力（不重复实现）
- 管理后台 Layout 和导航框架
- 用户/群组/应用 CRUD API
- 审计日志采集管道
- 安全策略配置存储

### 依赖 S1~S2 的能力（不重复实现）
- 认证/JWT/RBAC（S1-1/S1-2）
- 通知服务（S1-2 notification.service）— S3-3 扩展通知中心 UI
- 配额服务（S1-3）
- 外部观测配置（S2-1 ObservabilityConfig）

### S3-3 新增的能力
- **TenantLifecycleService（新增）**：Tenant 创建/禁用/启用/删除全生命周期管理
- **WebhookEngine（新增）**：事件匹配 → 签名生成 → HTTP POST → 重试 → 投递日志
- **OpenAPIAuthMiddleware（新增）**：API Key / OAuth2 Token 认证中间件
- **I18nProvider（新增）**：前端多语言 Provider + 翻译文件管理（zh/en）
- **ThemeProvider（新增）**：前端主题 Provider + CSS 变量注入
- **NotificationCenter（新增/扩展）**：前端通知中心组件 + 通知列表 API
- **SystemAnnouncementService（新增）**：公告 CRUD + 广播 + 展示

## 必须参考的文档

1. **docs/roadmap/PHASE1_BACKLOG.md** → S3-3 章节
2. **docs/prd/PRD_ADMIN.md** → 读以下章节：
   - §3 ROOT ADMIN 功能（租户管理/全局配置）
   - §12 系统设置（全部 Settings 字段）
3. **docs/prd/PRD.md** → 读以下章节：
   - §9 Open API 与 Webhook
   - §10 多语言与品牌定制
   - §11 通知系统
   - §12 可靠性与性能
4. **docs/feature-list/feature-list.json** → 读 F-ADMIN-PLAT-001~003、F-ADMIN-SETTINGS-001~011、F-OPEN-001~002、F-I18N-001、F-BRAND-001、F-A11Y-001、F-NOTIF-001~002、F-UX-001、F-REL-001~004 共 18+ 个条目
5. **docs/roadmap/PHASE1_ACCEPTANCE.md** → S3-3 验收条目

## User Story 组织建议

- **US1（P0）ROOT ADMIN 租户管理**：F-ADMIN-PLAT-001 + F-ADMIN-PLAT-002 + F-ADMIN-PLAT-003 → ROOT ADMIN 创建新 Tenant（30s 内可用），配置 Tenant 总配额上限，设置平台全局默认配置。禁用/启用 Tenant 即时生效。
- **US2（P0）系统设置**：F-ADMIN-SETTINGS-001~011 → Tenant Admin 配置所有系统设置项（基础信息/品牌/多语言/Webhook/观测/通知/公告/文件上传/对话分享/API Key）。
- **US3（P1）Open API & Webhook**：F-OPEN-001 + F-OPEN-002 + F-ADMIN-SETTINGS-004 + F-ADMIN-SETTINGS-011 → 提供 RESTful Open API（API Key + OAuth2 认证）。Webhook 事件订阅和投递（P95 ≤ 30s，3 次重试 ≥ 99%）。Admin 管理 API Key 和 Webhook 配置。
- **US4（P0）多语言与品牌**：F-I18N-001 + F-BRAND-001 + F-ADMIN-SETTINGS-002 + F-ADMIN-SETTINGS-003 → 全平台中英文切换。Tenant 可定制 Logo/颜色/标题。
- **US5（P1）通知与公告**：F-NOTIF-001 + F-NOTIF-002 + F-ADMIN-SETTINGS-006 + F-ADMIN-SETTINGS-007 → 用户查看站内通知（未读标记/已读/清除）。ROOT/Tenant Admin 发布系统公告。
- **US6（P1）可靠性与可访问性**：F-A11Y-001 + F-UX-001 + F-REL-001~004 → 键盘导航/响应式/高可用/性能/容量/备份恢复。

## Edge Cases 提示

- **禁用 Tenant 的正在使用的用户**：Tenant 禁用时所有活跃 session 立即失效 → 用户收到"组织已暂停"提示
- **删除 Tenant 的数据清理**：逻辑删除 + 90 天延迟物理清理；审计日志保留 180 天（合规最低要求）
- **Webhook 投递失败**：3 次重试（指数退避：10s/30s/90s），3 次全失败 → 记录失败日志 + 站内通知 Admin
- **Webhook 签名验证**：使用 HMAC-SHA256 签名，endpoint 可选验证
- **API Key 泄露**：Admin 可即时撤销（立即生效），撤销事件记录审计
- **多语言切换**：切换后页面不刷新，动态替换文本（React Context 切换）
- **品牌定制冲突**：自定义颜色导致文字不可读 → 前端校验对比度（WCAG AA 标准 4.5:1）
- **平台公告 vs Tenant 公告**：平台公告对所有 Tenant 可见且置顶优先级高于 Tenant 公告
- **通知爆炸**：配额告警频繁触发 → 同类通知 5 分钟内聚合为 1 条
- **RPO/RTO 保证**：需要外部数据库备份配置支持，AgentifUI 自身不做备份调度

## 边界约束

- ❌ 不涉及用户/群组/应用 CRUD 基础操作（复用 S3-1）
- ❌ 不涉及审计日志查询/导出/PII/输出合规（复用 S3-2）
- ❌ 不涉及邮件/短信通知（v2.0+）
- ❌ 不涉及自定义域名白标（Out-of-Scope）
- ❌ 不涉及 SCIM 用户同步（Out-of-Scope）
- ❌ 不涉及 PII 关联追溯（v2.0+）
- ❌ 不涉及货币汇率转换（v2.0+）
- ❌ 不写技术实现方案（Spec 只写 What 不写 How）
- ❌ 不使用「待定」「假设」「可能」等模糊字样
