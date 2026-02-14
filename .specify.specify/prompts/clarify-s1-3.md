请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

以下澄清点基于对 docs/prd/PRD.md §4.2.5/§6.2a/§10.5/§11.2、docs/tech/data-model/DOMAIN_MODEL_P1.md §3.4/§6、docs/feature-list/feature-list.json F-APP-001/004 + F-QUOTA-001~004、docs/roadmap/PHASE1_ACCEPTANCE.md §2.3、specs/002-rbac-authorization-model/spec.md 的交叉分析得出。

---

## 一、配额数据模型（3 个澄清点）

### Q1：配额用独立表还是基于 Run 聚合？
- **影响级别**：🔴 高
- **文档依据**：DOMAIN_MODEL_P1.md §6 待确认项第 1 条
- **澄清结论**：使用独立的 Quota + QuotaUsage 表模式
  - **Quota 表**：定义配额限额（Tenant/Group/User 各一条记录），存储 limitValue、currentUsage、resetPeriod、resetAt
  - **QuotaUsage 表**：记录每次扣减流水（delta、runId、appId、model、traceId、activeGroupId），用于归因分析
  - **理由**：实时扣减需要原子性操作（UPDATE ... SET currentUsage = currentUsage + delta WHERE currentUsage + delta <= limitValue），聚合计算无法满足 P0 的并发拦截需求
- **对 spec 的更新**：在 Key Entities 中明确定义 Quota 和 QuotaUsage 的字段

### Q2：配额重置如何实现？
- **影响级别**：🟡 中
- **文档依据**：PRD §4.2.5（默认自然月，Tenant 可配为自然周）
- **澄清结论**：
  - **重置机制**：定时任务（每小时检查一次），对所有 resetAt ≤ now() 的 Quota 记录重置 currentUsage = 0 并更新 resetAt 到下一周期
  - **resetPeriod**：monthly（默认）或 weekly
  - **resetAt 计算**：monthly = 下月 1 日 00:00 UTC，weekly = 下周一 00:00 UTC
  - **边界处理**：重置和扣减可能并发 → 重置操作使用 WHERE resetAt <= now() 原子更新，避免竞态
- **对 spec 的更新**：在 FR 中增加配额重置的非功能需求

### Q3：配额层级校验规则是什么？
- **影响级别**：🔴 高
- **文档依据**：PRD §4.2.5（细粒度约束优先，不允许突破 Tenant 总上限）
- **澄清结论**：
  - **设置时校验**：Tenant Admin 设置 Group/User 配额时，各子配额之和不必 ≤ 上级限额（超售允许），但单个子配额 ≤ 上级限额
  - **运行时校验**：每次请求同时检查三级（User → Group → Tenant），任一级超限即拒绝
  - **拦截响应**：返回具体信息：哪一级超限、当前用量/上限值、重置时间
  - **响应示例**：`{ "error": "quota_exceeded", "level": "group", "current": 95000, "limit": 100000, "resetsAt": "2026-03-01T00:00:00Z" }`
- **对 spec 的更新**：在 FR 中明确三级校验的执行顺序和拦截响应格式

---

## 二、应用目录与发现（3 个澄清点）

### Q4：App 实体字段在 S1-3 扩展到什么程度？
- **影响级别**：🟡 中
- **文档依据**：DOMAIN_MODEL_P1.md §3.4 App 定义（完整字段列表）；S1-2 spec（App 最小字段集 id/tenantId/name/status）
- **澄清结论**：
  - **S1-3 扩展字段**：在 S1-2 最小 App 基础上增加：description、icon、iconType、mode（chat/workflow/agent/completion）、tags（jsonb，用途标签数组）
  - **保留不动的字段**：externalId、externalPlatform、config、enableApi、apiRpm、createdBy → 这些字段在 schema 中定义但值为空/默认，由 S3-1 管理后台的应用注册功能负责填充
  - **新增字段**：
    - `isFeatured: boolean`（是否推荐）→ 用于工作台首页推荐展示
    - `sortOrder: integer`（排序权重）→ 用于全部应用列表的默认排序
  - **数据库迁移**：新增 migration 补充字段，确保 S1-2 已创建的 App 表向前兼容
- **对 spec 的更新**：在 Key Entities 中更新 App 实体的完整字段列表

### Q5：应用搜索的实现范围？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.2a（搜索应用名称与描述）；AC-S1-3-03（P95 ≤ 300ms）
- **澄清结论**：
  - **搜索范围**：应用名称 + 描述 + 标签
  - **搜索方式**：v1.0 使用 PostgreSQL ILIKE 模糊匹配（不引入全文搜索引擎）
  - **性能保障**：创建 GIN 索引 on (name, description) 以满足 P95 ≤ 300ms
  - **排序**：搜索结果按匹配度 + 最近使用时间排序
  - **分页**：默认 pageSize=20，cursor-based 分页
- **对 spec 的更新**：在 FR 中明确搜索实现方案

### Q6："最近使用"和"收藏"的存储和限制？
- **影响级别**：🟢 低
- **文档依据**：PRD §6.2a（最近使用、我的收藏）
- **澄清结论**：
  - **最近使用**：
    - 存储方式：独立 AppUsageHistory 表（userId, appId, tenantId, lastUsedAt），每次用户进入应用时 UPSERT
    - 展示限制：最多展示最近 10 个
    - 清理策略：超过 30 天的记录可清理
  - **收藏**：
    - 存储方式：独立 UserFavorite 表（userId, appId, tenantId, createdAt）
    - 数量限制：每用户最多 50 个收藏
    - 排序：按收藏时间倒序
  - **授权变更联动**：当应用授权被撤销时，最近使用和收藏记录保留但不在列表中展示（过滤逻辑在查询层）
- **对 spec 的更新**：在 Key Entities 中定义 UserFavorite 和 AppUsageHistory 实体

---

## 三、配额扣减与归因（2 个澄清点）

### Q7：配额扣减的时机和来源？
- **影响级别**：🔴 高
- **文档依据**：PRD §4.2.5（usage-based 归因）；DOMAIN_MODEL_P1.md Run.totalTokens
- **澄清结论**：
  - **扣减时机**：Run 完成后（status = succeeded/failed/stopped），根据 totalTokens 进行扣减
  - **扣减方式**：异步事件驱动 → Run 状态变更时发出 run.completed 事件，配额服务消费事件执行扣减
  - **三级扣减**：一次 Run 完成后同时扣减 User + Group（基于 activeGroupId）+ Tenant 三级配额
  - **扣减失败处理**：扣减失败不影响 Run 结果（已完成的不可回退），但记录日志 + 告警
  - **注意**：预检查在 Run 开始前执行（拦截），实际扣减在 Run 结束后执行
- **对 spec 的更新**：在 FR 中明确预检查和实际扣减的两阶段流程

### Q8：配额归因如何与 Active Group 关联？
- **影响级别**：🟡 中
- **文档依据**：PRD §4.2.4（扣费群组必须是授予该 App 访问权限的群组之一）；S1-2 spec Active Group
- **澄清结论**：
  - **归因规则**：配额扣减归因到 Run 记录的 activeGroupId
  - **校验**：activeGroupId 必须是授予用户该 App 访问权的群组之一（复用 S1-2 的 AppGrant 校验）
  - **无 Active Group 的情况**：如果用户通过直授（非群组授权）访问应用，配额扣减归因到 User 级，不扣减 Group 级
  - **QuotaUsage 流水**：记录 activeGroupId，用于后续按 Group 维度的成本报表
- **对 spec 的更新**：在 FR 中明确直授用户的配额归因特殊处理

---

## 四、告警与通知（3 个澄清点）

### Q9：配额告警通知的接收者规则？
- **影响级别**：🟡 中
- **文档依据**：F-QUOTA-004 notes（站内通知必选）；PRD §10.5（站内通知范围）
- **澄清结论**：
  - **告警层级与通知对象**：
    - User 级配额 80% → 通知该 User
    - User 级配额 90% → 通知该 User + 所属 Group 的 Manager
    - User 级配额 100% → 通知该 User + Manager + Tenant Admin
    - Group 级配额 80% → 通知 Group 的 Manager
    - Group 级配额 90% → 通知 Manager + Tenant Admin
    - Group 级配额 100% → 通知 Manager + Tenant Admin
    - Tenant 级配额 80%/90%/100% → 通知 Tenant Admin
  - **告警去重**：同一 QuotaId + 同一阈值 + 同一重置周期内只触发一次
  - **跳档处理**：如果从 79% 直接跳到 95%，触发 80% 和 90% 两个告警（不跳过中间阈值）
- **对 spec 的更新**：在 FR 中增加告警通知矩阵

### Q10：站内通知复用 S1-2 的 notification 还是新建？
- **影响级别**：🟡 中
- **文档依据**：S1-2 实现了 notification.service.ts（内存存储，用于 Break-glass 通知）
- **澄清结论**：
  - **复用并扩展**：在 S1-2 的 notification.service.ts 基础上，将存储从内存改为 PostgreSQL 表持久化
  - **新增 Notification 实体**：id, tenantId, recipientId, type（quota_alert/breakglass/system）, title, content, metadata（jsonb，存 quotaId/threshold/level 等）, isRead, createdAt
  - **保留期**：90 天，定时清理
  - **API**：GET /notifications（分页）、PATCH /notifications/:id/read、GET /notifications/unread-count
- **对 spec 的更新**：在 Key Entities 中新增 Notification 实体

### Q11：配额告警延迟 ≤ 5min 如何保障？
- **影响级别**：🟢 低
- **文档依据**：AC-S1-3-05（告警延迟 ≤ 5min）
- **澄清结论**：
  - **触发方式**：实时触发（在配额扣减时检查阈值），而非定时轮询
  - **流程**：扣减配额 → 检查 currentUsage/limitValue 是否达到阈值 → 若达到且未触发过该阈值 → 异步发送通知
  - **延迟来源**：主要是异步通知的消息队列延迟，正常情况下 < 1 分钟
  - **5min 是 SLA 上限**，正常操作延迟远低于此
- **对 spec 的更新**：无需额外更新，现有 FR 已覆盖

---

## 五、降级与边界（2 个澄清点）

### Q12：配额服务不可用时的降级策略？
- **影响级别**：🟡 中
- **文档依据**：AC-S1-3-B01（允许进入应用列表，禁止新对话）
- **澄清结论**：
  - **应用列表**：不受影响，正常展示（应用列表不依赖配额服务）
  - **新对话/执行**：拒绝，返回 503 + 提示"配额服务暂不可用，请稍后再试"
  - **已有对话**：允许继续（不中断正在进行的对话）
  - **超时定义**：配额检查超过 2 秒视为不可用
  - **降级通知**：向 Tenant Admin 发送系统告警
- **对 spec 的更新**：在 Non-Functional / Resilience 中明确降级策略

### Q13：S1-3 是否需要 Seed Data？
- **影响级别**：🟢 低
- **文档依据**：S1-2 实现了 roles / permissions / role-permissions 的 seed data
- **澄清结论**：
  - **需要**：
    - 示例 App 数据（3-5 个，覆盖不同 mode：chat/workflow/agent）→ 用于开发和测试
    - 对应的 AppGrant 记录（将示例 App 授权给默认 Group）
    - 默认 Tenant 配额（limitValue = 1,000,000 tokens/month）
  - **不需要**：Group/User 级配额（由 Tenant Admin 后续配置）
- **对 spec 的更新**：在实现注意事项中提及 seed data

---

## 六、输入验证与安全（2 个澄清点）

### Q14：配额 API 的输入验证规则？
- **影响级别**：🟡 中
- **文档依据**：S1-2 clarify 中已确立 input validation 原则（T016a）
- **澄清结论**：
  - **Quota 创建/更新**：
    - limitValue: 正整数，≥ 0，最大值 1,000,000,000（10 亿 tokens）
    - resetPeriod: enum ['monthly', 'weekly']
    - scope: enum ['tenant', 'group', 'user']
    - scopeId: 必须存在且属于当前 Tenant
  - **收藏操作**：
    - appId: 必须存在且用户有权访问
    - 重复收藏返回 409 Conflict
  - **搜索**：
    - query: 最大 100 字符，SQL 注入防护
    - 空搜索返回全部（分页）
- **对 spec 的更新**：在 FR 中补充输入验证约束

### Q15：Trace ID 如何在 S1-3 传播？
- **影响级别**：🟢 低
- **文档依据**：S1-2 clarify Q（T016b Trace ID propagation）
- **澄清结论**：
  - **复用 S1-2 的 Trace ID 中间件**：所有 API 请求自动注入 traceId
  - **配额流水记录 traceId**：QuotaUsage.traceId 关联到触发扣减的 Run 的 traceId
  - **告警通知记录 traceId**：便于追溯告警触发的具体请求
- **对 spec 的更新**：确保配额相关 FR 包含 traceId 关联要求
