请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

---

## 一、Run 状态机与生命周期（3 个澄清点）

### Q1：Run 状态机的完整定义？
- **影响级别**：🔴 高
- **文档依据**：PRD §6.9 + F-RUN-002
- **澄清结论**：
  - **状态**：pending → running → completed | failed | stopped
  - **转换规则**：
    - `pending → running`：后端确认开始执行
    - `running → completed`：后端返回成功结果
    - `running → failed`：后端返回错误 或 超时（30 分钟无更新）
    - `running → stopped`：用户触发停止 且 后端确认取消成功
    - `pending → failed`：排队超时（5 分钟未开始执行）
  - **终态**：completed / failed / stopped 为终态，不可逆转
  - **前端刷新**：running 状态下每 3 秒轮询（不使用 WebSocket，v1.0 复杂度控制）
- **对 spec 的更新**：在 FR 中定义完整状态机和转换规则

### Q2：不同 Run 类型的差异？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.9 + F-RUN-001
- **澄清结论**：
  - **Generation Run**：对应 Chatbot/Chatflow 模式，每条 AI 回复 = 一个 Run
  - **Agent Run**：对应 Agent 模式，可能包含多个 RunStep（思考/调用工具/输出）
  - **Workflow Run**：对应 Workflow 模式，包含多个有向无环图节点的 RunStep
  - **统一展示**：所有类型在运行记录列表中格式一致（Run.type 标签区分）
  - **详情差异**：
    - Generation Run：展示 Token 用量、耗时
    - Agent Run：展示 RunStep 列表（step index + 节点类型 + 状态 + 各步 Token）
    - Workflow Run：展示 RunStep 列表 + 可折叠的节点执行详情
- **对 spec 的更新**：在 FR 中定义各 Run 类型的展示差异

### Q3：Run 和 Conversation/Message 的关联关系？
- **影响级别**：🔴 高
- **文档依据**：DOMAIN_MODEL_P1.md Run 实体定义
- **澄清结论**：
  - **一对多**：一个 Conversation 包含多个 Run（每次 AI 回复 / 每次触发执行 = 一个 Run）
  - **关联路径**：Run.conversationId → Conversation.id；Run 可以通过 Message.runId 关联到具体消息
  - **独立 Run**：非对话模式的 Workflow 可不依赖 Conversation，直接独立创建 Run
  - **运行记录入口**：
    - 在对话页面：消息气泡内展示 Run 状态/耗时/Trace
    - 在应用页面：独立的"运行记录"Tab，列出该应用所有 Run
- **对 spec 的更新**：在 Key Entities 中明确 Run-Conversation-Message 关系

---

## 二、RAG 引用展示（2 个澄清点）

### Q4：RAG 引用数据的来源和格式？
- **影响级别**：🟡 中
- **文档依据**：F-APP-003 + PRD §6.3
- **澄清结论**：
  - **数据来源**：后端（如 Dify）在响应中返回引用信息，包含在 SSE 流的 metadata 中
  - **数据格式**：Message.contentParts 中的 `{ type: 'citation', citation: CitationPayload }`
  - **CitationPayload**：
    ```
    { id: string,
      title: string,
      snippet: string,
      url?: string,
      score?: number,
      documentName?: string }
    ```
  - **渲染方式**：在消息文本中以上标数字标注 [1][2]，底部展示来源列表
  - **不可用降级**：后端不返回引用 → 正常展示文本，不显示引用区域
- **对 spec 的更新**：在 FR 中定义 RAG 引用渲染规则

### Q5：引用来源是否可跳转？
- **影响级别**：🟢 低
- **文档依据**：无直接文档依据
- **澄清结论**：
  - **有 URL**：点击引用来源可跳转到外部链接（新标签页打开）
  - **无 URL**：仅展示摘要文本，不可点击
  - **安全**：跳转前校验 URL 为 http/https 协议，其他协议忽略
- **对 spec 的更新**：在 FR 中说明引用跳转行为

---

## 三、数据持久化与回源（3 个澄清点）

### Q6：数据持久化的一致性保证？
- **影响级别**：🔴 高
- **文档依据**：PRD §6.8 + F-DATA-001
- **澄清结论**：
  - **写入时机**：
    - 消息：SSE 流结束后，将完整消息写入 Message 表（不在流式中间写入）
    - Run：创建时写入 pending 状态，每次状态变更时更新
    - Conversation：首条消息发送时创建
  - **事务边界**：消息写入和 Run 状态更新在同一事务中完成
  - **幂等性**：clientId 用于防止重复创建（INSERT ... ON CONFLICT DO NOTHING）
  - **失败处理**：持久化失败 → 返回 500 错误 → 前端提示"保存失败，请重试"
- **对 spec 的更新**：在 FR 中定义持久化时机和一致性保证

### Q7：数据删除的不同策略？
- **影响级别**：🟡 中
- **文档依据**：F-DATA-001 notes（删除优先级定义）
- **澄清结论**：
  - **用户自删对话**：即时逻辑删除（status='deleted'），保留删除审计事件
  - **Admin 删用户**：30 天冷静期 → 期间可恢复 → 过期后脱敏保留（用户 PII 清除，对话内容保留匿名）
  - **ROOT 删租户**：即时标记（status='disabled'）→ 延迟清理（默认 90 天后物理删除）
  - **审计日志例外**：即使租户删除，审计日志仍保留至少 180 天（法务合规最短保留期）
  - **应用删除**：对话历史只读保留，应用状态标记 'deleted'，UI 展示"应用已删除"
- **对 spec 的更新**：在 FR 中定义删除策略矩阵

### Q8：数据回源的触发条件和流程？
- **影响级别**：🟡 中
- **文档依据**：F-DATA-002
- **澄清结论**：
  - **触发条件**：
    - 自动：用户打开对话列表时检测本地数据是否完整（createdAt 间隙检测）
    - 用户触发：点击"刷新/同步"按钮
    - 管理员触发：管理后台"数据校验"功能
  - **同步流程**：
    1. 记录 DataSyncLog（status='pending'）
    2. 调用后端 API 拉取缺失数据
    3. 更新本地数据
    4. 更新 DataSyncLog（status='completed' 或 'failed'）
  - **降级展示**：回源失败 → 展示本地已有数据 + 顶部 Banner 提示"数据可能不完整"
  - **频率限制**：同一 Conversation 5 分钟内最多触发 1 次回源
- **对 spec 的更新**：在 FR 中定义回源触发条件和降级行为

---

## 四、安全控制（2 个澄清点）

### Q9：提示词注入检测的实现方式？
- **影响级别**：🟡 中
- **文档依据**：PRD §8.1 + F-SEC-001
- **澄清结论**：
  - **检测位置**：网关层，在消息发送到后端之前
  - **检测方式**：v1.0 使用规则引擎（关键词 + 正则模式匹配），不接入 AI 分类模型
  - **规则示例**：
    - 典型注入模式：`ignore previous instructions`、`system prompt`、`act as`
    - 编码绕过：Base64 编码指令、Unicode 变体
    - 分数范围：0.0 ~ 1.0（基于匹配规则数量和严重程度加权）
  - **处置策略**（tenantConfig.security.promptInjection.action）：
    - `log`（默认）：记录日志，不阻断
    - `alert`（默认开启）：记录日志 + 站内通知 Tenant Admin
    - `block`（可选）：拒绝消息发送，返回"检测到潜在安全风险"
  - **误报处理**：Admin 可在审计日志中查看检测记录并标记误报
- **对 spec 的更新**：在 FR 中定义注入检测管线和策略配置

### Q10：会话隔离的具体实现边界？
- **影响级别**：🔴 高
- **文档依据**：F-SEC-002 + PRD §8
- **澄清结论**：
  - **用户间隔离**：
    - DB 层：所有查询强制附加 `WHERE userId = :currentUserId AND tenantId = :currentTenantId`
    - API 层：控制器中校验资源归属后再返回数据
    - 例外：Admin 查看他人对话需 break-glass 审批 + 审计
  - **应用间隔离**：
    - 对话上下文不跨应用：Conversation.appId 固定，不可在 App A 的对话中引用 App B 的历史
    - 后端会话隔离：每个 App 使用独立的后端会话 ID（即使同一用户）
  - **Tenant 间隔离**：
    - 复用 S1-1 的 RLS（Row Level Security）
    - Conversation/Message/Run 表均有 tenantId 字段
  - **测试验证**：需编写安全测试用例覆盖跨用户/跨应用/跨租户访问
- **对 spec 的更新**：在 FR 中定义隔离边界和校验规则
