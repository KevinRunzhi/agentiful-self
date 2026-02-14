请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

---

## 一、ROOT ADMIN 平台管理（2 个澄清点）

### Q1：Tenant 创建的完整流程？
- **影响级别**：🔴 高
- **文档依据**：F-ADMIN-PLAT-001（创建 ≤ 30s 可用）
- **澄清结论**：
  - **创建流程**：ROOT ADMIN 填写 Tenant 信息（name、slug、admin_email）→ 系统自动创建 Tenant → 创建默认 Group（All Members）→ 创建 Tenant Admin 账号 → 发送激活邮件
  - **初始化**：默认配额配置、默认安全策略、默认保留期配置均使用全局默认值
  - **30s 可用**：从提交到 Admin 可登录使用 ≤ 30s
  - **slug 唯一性**：全局唯一，用于 URL 区分（如 /tenant/{slug}/login）
  - **Tenant 上限**：v1.0 不限制 Tenant 数量，但单个数据库实例建议 ≤ 1000 Tenant
- **对 spec 的更新**：在 FR 中定义 Tenant 创建流程

### Q2：Tenant 禁用/删除的影响范围？
- **影响级别**：🔴 高
- **文档依据**：F-ADMIN-PLAT-001
- **澄清结论**：
  - **禁用**：即时生效 → 所有用户 session 失效 → 登录页显示"组织已暂停" → 数据保留 → 可随时启用恢复
  - **删除**：逻辑删除（status='deleted'）→ 90 天延迟物理清理 → 期间可恢复 → 90 天后永久删除所有数据
  - **审计保留**：即使 Tenant 删除，审计日志仍保留 180 天（合规要求）
  - **正在进行的操作**：禁用时正在进行的 SSE 流立即中断 → 用户看到错误提示
  - **Open API**：Tenant 禁用后所有 API Key 失效
- **对 spec 的更新**：在 FR 中定义 Tenant 禁用/删除策略

---

## 二、系统设置（3 个澄清点）

### Q3：11 个系统设置项的存储方式？
- **影响级别**：🟡 中
- **文档依据**：F-ADMIN-SETTINGS-001~011
- **澄清结论**：
  - **存储**：Tenant.customConfig jsonb 字段，按命名空间组织：
    - `branding`：primary_color、secondary_color、logo、favicon、site_name
    - `i18n`：default_language、allow_user_override
    - `webhook`：url、subscribed_events、signing_secret、enabled
    - `observability`：url_template、platform_type
    - `notification`：types_enabled、retention_days
    - `file_upload`：max_size_mb、allowed_types、retention_days
    - `conversation_share`：default_ttl_days、max_ttl_days、require_login
  - **版本号**：每次修改 configVersion 自增，用于缓存失效
  - **默认值**：未配置时使用 PlatformConfig 中的全局默认值
  - **变更审计**：每次保存记录 before/after JSON diff
- **对 spec 的更新**：在 Key Entities 中定义 Tenant.customConfig 结构

### Q4：Webhook 事件订阅和投递机制？
- **影响级别**：🔴 高
- **文档依据**：F-OPEN-002 + F-ADMIN-SETTINGS-004
- **澄清结论**：
  - **可订阅事件类型**：
    - `user.created` / `user.deleted` / `user.status_changed`
    - `conversation.created` / `conversation.completed`
    - `run.completed` / `run.failed`
    - `quota.threshold_reached` / `quota.exceeded`
    - `security.injection_detected` / `security.compliance_blocked`
  - **投递格式**：HTTP POST + JSON body + HMAC-SHA256 签名（X-Webhook-Signature header）
  - **重试策略**：失败后 3 次重试（指数退避 10s/30s/90s），3 次全失败 → 标记 failed → 通知 Admin
  - **投递日志**：记录每次投递（timestamp、event_type、status、response_code、response_time）
  - **首次投递 P95**：≤ 30s（从事件发生到首次 HTTP POST）
  - **批量事件**：高频事件（如消息级别）不发 Webhook，仅会话/运行级别事件
- **对 spec 的更新**：在 FR 中定义 Webhook 事件列表和投递机制

### Q5：API Key 认证的安全约束？
- **影响级别**：🟡 中
- **文档依据**：F-ADMIN-SETTINGS-011 + F-OPEN-001
- **澄清结论**：
  - **生成**：Admin 创建 API Key 时系统生成随机 Key（前缀 `ak_`），仅创建时展示一次明文
  - **存储**：SHA-256 哈希存储（不可逆）
  - **权限**：API Key 绑定到 Tenant，权限等级等同 Tenant Admin（v1.0 不支持细粒度 scope）
  - **撤销**：即时生效（哈希删除）
  - **上限**：每 Tenant 最多 10 个有效 API Key
  - **审计**：创建/使用/撤销均记录审计
  - **速率限制**：每 Key 默认 60 RPM（v1.0 固定，不可配）
- **对 spec 的更新**：在 FR 中定义 API Key 生命周期

---

## 三、多语言与品牌（2 个澄清点）

### Q6：多语言实现方案的范围？
- **影响级别**：🟡 中
- **文档依据**：F-I18N-001 + F-ADMIN-SETTINGS-003
- **澄清结论**：
  - **支持语言**：v1.0 仅 zh-CN 和 en-US 两种
  - **翻译范围**：所有 UI 文本、错误提示、邮件模板、系统通知
  - **切换方式**：用户个人偏好设置 > Tenant 默认语言 > 浏览器语言 > 系统默认（zh-CN）
  - **动态切换**：不刷新页面，React Context 切换
  - **翻译文件**：JSON 格式，按模块组织（common、auth、admin、chat 等）
  - **API 响应**：错误消息根据 Accept-Language header 返回对应语言
  - **后端消息**：审计日志/系统日志固定 en-US（统一分析）
- **对 spec 的更新**：在 FR 中定义多语言实现范围

### Q7：品牌定制的能力边界？
- **影响级别**：🟢 低
- **文档依据**：F-BRAND-001 + F-ADMIN-SETTINGS-002
- **澄清结论**：
  - **可定制项**：主色调、辅色、Logo（header 展示）、Favicon、浏览器标题
  - **实现方式**：CSS 变量注入（`--brand-primary`、`--brand-secondary`）
  - **Logo 上传**：支持 PNG/SVG，最大 500KB，推荐尺寸 200×40px
  - **暗色模式**：v1.0 支持（用户可切换），品牌色在暗色模式下自动调整亮度
  - **不可定制**：布局结构、字体、组件样式（仅颜色级）
  - **对比度校验**：品牌色与背景的对比度 ≥ 4.5:1（WCAG AA），不达标时 UI 提示
- **对 spec 的更新**：在 FR 中定义品牌定制能力

---

## 四、通知与可靠性（2 个澄清点）

### Q8：站内通知和系统公告的区别？
- **影响级别**：🟢 低
- **文档依据**：F-NOTIF-001 + F-NOTIF-002
- **澄清结论**：
  - **站内通知**：
    - 面向个人用户的消息（配额告警、授权变更、审批通知等）
    - 存入 Notification 表
    - 右上角铃铛图标 + 未读数 badge
    - 用户可标记已读/清除
    - 保留期 90 天
  - **系统公告**：
    - 面向所有用户或所有 Tenant 用户的广播消息
    - ROOT ADMIN 发布平台公告（全平台可见）
    - Tenant Admin 发布 Tenant 公告（仅该 Tenant 可见）
    - 以横幅 Banner 展示在页面顶部
    - 用户可关闭（dismiss）但不可删除
    - 关闭后不再展示，直至有新公告
  - **优先级**：平台公告 > Tenant 公告 > 个人通知
- **对 spec 的更新**：在 FR 中定义通知和公告的差异

### Q9：可靠性指标如何落地？
- **影响级别**：🟡 中
- **文档依据**：F-REL-001~004
- **澄清结论**：
  - **高可用**：
    - API 服务：无状态，支持多实例水平扩展
    - Web 前端：静态资源 CDN 分发
    - 数据库：单 Supabase 实例（v1.0），预留读写分离接口
    - 无单点：session 存储在 JWT（无状态），配置存储在 DB
  - **性能**：
    - 首屏加载 ≤ 2s（静态资源 + 首次 API 调用）
    - API P95 ≤ 500ms（CRUD 类操作）
    - 并发 ≥ 1000 同时在线用户
  - **容量**：单 Tenant ≥ 5 万用户、≥ 1000 应用、≥ 100 万条对话记录
  - **备份**：
    - RPO ≤ 24h：Supabase 自动每日备份
    - RTO ≤ 4h：从备份恢复的最大时间
    - AgentifUI 不自行实现备份，依赖数据库基础设施
  - **监控**：应用层健康检查 endpoint（`/healthz`）+ Trace 指标
- **对 spec 的更新**：在 NFR 中定义可靠性指标和落地方式
