请根据以下已确认的澄清结果，直接更新 spec.md，无需逐一提问。

---

## 一、对话核心流程（3 个澄清点）

### Q1：对话创建和消息发送的完整流程？
- **影响级别**：🔴 高
- **文档依据**：PRD §6.3 + F-CHAT-001
- **澄清结论**：
  - **新对话**：前端生成 clientId → 调用 `POST /api/v1/conversations`（appId, activeGroupId）→ 返回 conversationId → 发送首条消息
  - **发送消息**：`POST /api/v1/conversations/:id/messages`（content, clientId）→ 网关转发到后端 → SSE 流式响应 → 前端逐 chunk 渲染
  - **乐观更新**：消息发送后立即在 UI 展示（用 clientId 标识），收到服务端确认后替换为正式 ID
  - **首次会话标题**：首条消息发送后，由 AI 自动生成会话标题（异步）
- **对 spec 的更新**：在 FR 中定义完整的对话创建和消息发送流程

### Q2：停止生成的硬停/软停判断逻辑？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.5 + F-CHAT-005
- **澄清结论**：
  - **硬停**：后端支持取消（abort）→ 网关发送取消信号 → 审计记录"已取消"
  - **软停**：后端不支持取消 → 前端关闭 SSE 连接，停止渲染 → 提示"后端仍可能执行" →  审计记录"软停止"
  - **判断方式**：PlatformAdapter 提供 `supportsAbort(): boolean`，由适配器实现
  - **前端行为**：点击停止 → ≤ 500ms 停止渲染（无论硬停/软停）→ 显示已生成内容
  - **Token 计量**：软停止情况下，后端仍可能产生 Token → 仍按实际产出计量
- **对 spec 的更新**：在 FR 中明确硬停/软停判断和 UI 行为

### Q3：消息的 contentParts 如何渲染？
- **影响级别**：🟡 中
- **文档依据**：DOMAIN_MODEL_P1.md Message.contentParts
- **澄清结论**：
  - **渲染优先级**：如果 contentParts 存在则按 parts 数组顺序渲染，否则用 content 纯文本
  - **Part 类型**：
    - `text` → Markdown 渲染（支持代码高亮、LaTeX）
    - `think` → 折叠的"思考过程"区域
    - `image` → 图片展示
    - `artifact` → Artifact 卡片（可展开/保存）
    - `citation` → 引用来源标记（S2-3 实现展示）
  - **流式场景**：contentParts 在流式中逐步追加，前端需支持增量渲染
- **对 spec 的更新**：在 FR 中定义 contentParts 渲染规则

---

## 二、对话管理（2 个澄清点）

### Q4：对话列表的排序和分组规则？
- **影响级别**：🟢 低
- **文档依据**：F-CHAT-006（搜索/重命名/删除/固定/归档/分组）
- **澄清结论**：
  - **排序**：pinned 置顶 → 按 updatedAt 降序
  - **分组**：默认不分组，用户可创建自定义分组（v1.0 仅支持一级分组，不支持嵌套）
  - **归档**：status='archived'，不在主列表显示，可在"已归档"分类查看
  - **删除**：status='deleted'（逻辑删除），调用后立即从列表消失，审计保留删除事件
  - **搜索**：按 title 和 Message.content 模糊搜索，P95 ≤ 800ms（复杂列表指标）
  - **分页**：cursor-based，默认 pageSize=20
- **对 spec 的更新**：在 FR 中定义对话列表 API 和排序规则

### Q5：对话分享链接的访问控制？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.3 + F-CHAT-007
- **澄清结论**：
  - **分享码**：URL 格式 `/share/{shareCode}`，shareCode 为 nanoid(12)
  - **可见范围**：
    - 启用登录（requireLogin=true，默认）：仅同 Tenant + 同 Group 成员可访问
    - 关闭登录（requireLogin=false）：公开，任何人可访问
  - **有效期**：默认永久（expiresAt=null），Tenant 可配置默认有效期和最长有效期
  - **撤销**：创建者或 Tenant Admin 可撤销
  - **只读**：分享链接只能查看，不能发送新消息
  - **审计**：创建/撤销/访问分享链接均需审计
- **对 spec 的更新**：在 Key Entities 中定义 ConversationShare 实体

---

## 三、文件处理（2 个澄清点）

### Q6：文件存储架构？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.4 + F-FILE-001
- **澄清结论**：
  - **上传流程**：前端 → 网关（基础校验：大小/类型/数量）→ 存储服务 → 返回 fileUrl
  - **存储**：v1.0 使用本地文件系统 + 可配置路径，预留 S3 对象存储接口
  - **校验**：
    - 大小：默认 50MB（Tenant 可配 ≤ 200MB，应用级仅可收紧）
    - 类型：白名单（doc/pdf/txt/png/jpg/gif/mp3/mp4 等）
    - 数量：单次默认 10 个（Tenant 可配 ≤ 20 个）
  - **安全扫描**：v1.0 仅做文件类型校验（不实现病毒扫描，标记 scanStatus='skipped'）
  - **保留期**：默认 90 天，定时清理过期文件
  - **与消息关联**：FileAttachment 表关联 messageId
- **对 spec 的更新**：在 Key Entities 中定义 FileAttachment 实体

### Q7：Artifacts 的版本管理规则？
- **影响级别**：🟢 低
- **文档依据**：PRD §6.6 + F-ART-001
- **澄清结论**：
  - **自动草稿**：AI 每次输出代码/文档时自动创建 Artifact 草稿（isDraft=true）
  - **稳定版本**：用户点击"保存"后生成稳定版本（isDraft=false，version 自增）
  - **草稿清理**：同一会话内草稿最多保留最近 10 个，超出自动删除最早的
  - **稳定版本留存**：受 Tenant 策略约束（默认不限制数量）
  - **下载**：至少支持纯文本导出（.txt/.md），代码支持原格式导出
  - **安全预览**：可执行内容在沙箱中预览（iframe sandbox），Tenant 可禁用预览
- **对 spec 的更新**：在 Key Entities 中定义 Artifact 实体

---

## 四、HITL 结构化交互（2 个澄清点）

### Q8：HITL 消息协议格式？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.7 + F-HITL-001
- **澄清结论**：
  - **触发方式**：后端在 SSE 流中返回特殊类型的 chunk，包含结构化交互 schema
  - **消息格式**：在 contentParts 中增加 `{ type: 'hitl', hitl: HITLPayload }`
  - **HITLPayload 结构**：
    ```
    { action: 'confirm'|'select'|'approve'|'input',
      title: string,
      description?: string,
      options?: { id: string, label: string }[],
      required: boolean,
      timeoutMs?: number }
    ```
  - **用户响应**：`POST /api/v1/conversations/:id/messages/:messageId/hitl-response`
  - **超时处理**：timeoutMs 到期后自动发送 timeout 响应给后端
- **对 spec 的更新**：在 FR 中定义 HITL 协议和 UI 交互

### Q9：HITL 前端渲染组件？
- **影响级别**：🟢 低
- **文档依据**：PRD §6.7（前端仅渲染与回传）
- **澄清结论**：
  - **confirm**：渲染"确认/取消"按钮
  - **select**：渲染单选/多选列表
  - **approve**：渲染"批准/拒绝"按钮 + 可选理由输入
  - **input**：渲染文本输入框 + 提交按钮
  - **状态**：pending（等待用户）→ responded（已回复）→ expired（超时）
  - **样式**：与普通消息气泡区分，使用交互卡片样式
- **对 spec 的更新**：在 FR 中描述 HITL 渲染组件类型

---

## 五、性能与可靠性（2 个澄清点）

### Q10：首 Token P95 ≤ 1.5s 如何度量？
- **影响级别**：🟡 中
- **文档依据**：PRD §6.9 + AC-S2-2-01
- **澄清结论**：
  - **度量起点**：前端发送消息请求的时间
  - **度量终点**：前端收到 SSE 第一个 content chunk 的时间
  - **AgentifUI 自身开销**：≤ 200ms（认证 + 权限 + 配额检查 + 路由 + 适配）
  - **1.5s 包含**：AgentifUI 开销（≤200ms）+ 后端响应时间（≤1.3s）
  - **监测方式**：前端埋点 + Trace span 记录
- **对 spec 的更新**：在 NFR 中明确 TTFT 度量方法

### Q11：消息失败重试策略？
- **影响级别**：🟢 低
- **文档依据**：无直接文档依据
- **澄清结论**：
  - **自动重试**：不自动重试（避免重复扣费和重复执行）
  - **手动重试**：用户可点击"重新生成"按钮重新发送
  - **错误展示**：失败消息显示错误原因 + "重新生成"按钮
  - **超时**：60s 无响应（含心跳）视为超时失败
- **对 spec 的更新**：在 FR 中说明错误处理和重试策略
