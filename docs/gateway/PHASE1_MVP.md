# AgentifUI Gateway Phase 1 MVP

* **规范版本**：v0.1
* **最后更新**：2026-01-27
* **状态**：草稿
* **目标**：定义 Phase 1 最小可用版本的范围和实现优先级

---

## 1. MVP 目标

### 1.1 核心目标

> **让前端能够通过统一接口与 Dify 后端通信，具备基本的认证和追踪能力。**

### 1.2 成功标准

| 标准 | 验收条件 |
|------|----------|
| **功能完整** | 支持完整的对话流程（发送消息、流式响应、停止生成） |
| **OpenAI 兼容** | 前端使用标准 OpenAI SDK 可正常调用 |
| **基础安全** | JWT 认证有效、请求有限流 |
| **可追踪** | Trace ID 端到端可用 |
| **可部署** | Docker 镜像可直接运行 |

---

## 2. Phase 1 范围

### 2.1 功能范围

| 模块 | Phase 1 范围 | 延后到 Phase 2 |
|------|-------------|----------------|
| **认证** | ✅ JWT 验证 | API Key、mTLS |
| **授权** | ✅ 调用 Core API 检查 | 本地缓存、复杂策略 |
| **配额** | ❌ 跳过 | 完整配额系统 |
| **限流** | ✅ 简单全局限流 | 多层级限流 |
| **审计** | ✅ 同步 HTTP 发送 | 异步队列 |
| **追踪** | ✅ Trace ID 生成/传递 | 完整 OpenTelemetry 导出 |
| **后端** | ✅ 仅 Dify | Coze、n8n、OpenAI |
| **降级** | ✅ 基础错误处理 | 熔断、优雅降级 |

### 2.2 API 端点

| 端点 | 方法 | Phase 1 | 说明 |
|------|------|---------|------|
| `/v1/chat/completions` | POST | ✅ | 对话完成（阻塞+流式） |
| `/v1/chat/completions/{task_id}/stop` | POST | ✅ | 停止生成 |
| `/v1/models` | GET | ✅ | 应用列表 |
| `/v1/conversations` | GET | ❌ | → Core API |
| `/v1/conversations/{id}/messages` | GET | ❌ | → Core API |
| `/health` | GET | ✅ | 健康检查 |
| `/metrics` | GET | ⚠️ 可选 | Prometheus 指标 |

---

## 3. 技术实现

### 3.1 核心代码量估算

| 模块 | 预估行数 | 说明 |
|------|----------|------|
| `app.ts` + `main.ts` | ~100 | 应用启动 |
| `config/` | ~150 | 配置加载 |
| `plugins/tracing.ts` | ~50 | Trace ID |
| `plugins/auth.ts` | ~80 | JWT 验证 |
| `plugins/authz.ts` | ~60 | 授权检查 |
| `plugins/rate-limit.ts` | ~30 | 限流配置 |
| `plugins/audit.ts` | ~80 | 审计发送 |
| `routes/v1/chat.ts` | ~200 | 对话路由及 SSE |
| `routes/v1/models.ts` | ~50 | 模型列表 |
| `adapters/dify.ts` | ~200 | Dify 适配 |
| `services/core-api.ts` | ~100 | Core API 客户端 |
| `lib/` | ~150 | 工具函数 |
| **总计** | **~1,250** | **约 3-5 天完成** |

### 3.2 依赖精简

Phase 1 使用最小依赖集：

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "pino": "^9.0.0",
    "zod": "^3.23.0"
  }
}
```

**延后引入**：
- `@fastify/http-proxy`（Phase 1 手动 fetch）
- `@opentelemetry/*`（Phase 1 仅 Trace ID，不导出）
- `bullmq`（Phase 1 同步审计）

---

## 4. 详细实现规范

### 4.1 应用入口

```typescript
// src/app.ts
import Fastify from 'fastify';
import { loadConfig } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';

export async function buildApp() {
  const config = loadConfig();
  
  const app = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.logging.prettyPrint 
        ? { target: 'pino-pretty' } 
        : undefined
    },
    requestIdHeader: 'x-trace-id',
    genReqId: () => crypto.randomUUID()
  });
  
  // 注册插件
  await registerPlugins(app, config);
  
  // 注册路由
  await registerRoutes(app);
  
  return app;
}
```

### 4.2 认证插件 (Phase 1 简化版)

```typescript
// src/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (fastify, opts) => {
  // 注册 JWT
  await fastify.register(jwt, {
    secret: opts.config.auth.jwtSecret,
    decoratorName: 'jwt'
  });
  
  // 扩展 request 类型
  fastify.decorateRequest('user', null);
  
  // 全局认证钩子（排除健康检查）
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    
    try {
      const payload = await request.jwtVerify();
      request.user = {
        id: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.roles ?? []
      };
    } catch (err) {
      return reply.code(401).send({
        error: {
          message: 'Invalid or expired token',
          type: 'authentication_error',
          code: 'invalid_token'
        }
      });
    }
  });
}, { name: 'auth' });
```

### 4.3 Dify 适配器 (Phase 1)

```typescript
// src/adapters/dify.ts
import type { ChatRequest, SSEEvent } from '../types';

export class DifyAdapter {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}
  
  async *chat(request: ChatRequest): AsyncGenerator<SSEEvent> {
    const difyRequest = {
      inputs: request.inputs ?? {},
      query: this.extractQuery(request.messages),
      response_mode: request.stream ? 'streaming' : 'blocking',
      conversation_id: request.conversation_id,
      user: request.user_id
    };
    
    const response = await fetch(`${this.baseUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(difyRequest)
    });
    
    if (!response.ok) {
      throw new BackendError(response.status, await response.text());
    }
    
    if (!request.stream) {
      // 阻塞模式
      const data = await response.json();
      yield this.transformBlockingResponse(data);
      return;
    }
    
    // 流式模式
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());
          yield this.transformStreamEvent(data);
        }
      }
    }
  }
  
  async stop(taskId: string): Promise<StopResult> {
    const response = await fetch(
      `${this.baseUrl}/v1/chat-messages/${taskId}/stop`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }
    );
    
    if (!response.ok) {
      return { success: true, type: 'soft' }; // 降级处理
    }
    
    return { success: true, type: 'hard' };
  }
  
  private transformStreamEvent(difyEvent: any): SSEEvent {
    // Dify → OpenAI 格式转换
    switch (difyEvent.event) {
      case 'message':
        return {
          id: difyEvent.message_id,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: { content: difyEvent.answer },
            finish_reason: null
          }]
        };
      case 'message_end':
        return {
          id: difyEvent.message_id,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }],
          usage: difyEvent.metadata?.usage
        };
      // ... 其他事件
    }
  }
}
```

### 4.4 对话路由 (Phase 1)

```typescript
// src/routes/v1/chat.ts
import type { FastifyPluginAsync } from 'fastify';
import { DifyAdapter } from '../../adapters/dify';

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  const difyAdapter = new DifyAdapter(
    fastify.config.backends.dify.baseUrl,
    fastify.config.backends.dify.apiKey
  );
  
  // POST /v1/chat/completions
  fastify.post('/chat/completions', {
    schema: {
      body: ChatCompletionRequestSchema,
      response: {
        200: ChatCompletionResponseSchema
      }
    }
  }, async (request, reply) => {
    const { user } = request;
    const body = request.body as ChatCompletionRequest;
    
    // 1. 授权检查
    const authzResult = await fastify.coreApi.checkAuthz({
      userId: user.id,
      tenantId: user.tenantId,
      resourceType: 'app',
      resourceId: body.app_id,
      action: 'execute'
    });
    
    if (!authzResult.allowed) {
      return reply.code(403).send({
        error: {
          message: 'Access denied to this app',
          type: 'permission_denied',
          code: 'app_not_authorized'
        }
      });
    }
    
    // 2. 执行对话
    if (body.stream) {
      // 流式响应
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('X-Trace-ID', request.id);
      
      const stream = reply.raw;
      
      try {
        for await (const event of difyAdapter.chat({
          ...body,
          user_id: user.id
        })) {
          stream.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        stream.write('data: [DONE]\n\n');
      } catch (error) {
        stream.write(`data: ${JSON.stringify({ error })}\n\n`);
      } finally {
        stream.end();
        
        // 3. 审计记录
        fastify.coreApi.sendAudit({
          traceId: request.id,
          actor: { type: 'user', id: user.id, tenantId: user.tenantId },
          action: 'chat.completion.create',
          resource: { type: 'app', id: body.app_id },
          outcome: 'success'
        });
      }
    } else {
      // 阻塞响应
      const events = [];
      for await (const event of difyAdapter.chat({ ...body, user_id: user.id })) {
        events.push(event);
      }
      
      return {
        ...events[events.length - 1],
        trace_id: request.id
      };
    }
  });
  
  // POST /v1/chat/completions/:task_id/stop
  fastify.post('/chat/completions/:task_id/stop', async (request, reply) => {
    const { task_id } = request.params as { task_id: string };
    const result = await difyAdapter.stop(task_id);
    return { result: 'success', stop_type: result.type };
  });
};
```

---

## 5. 开发计划

### 5.1 时间线

| 阶段 | 天数 | 交付物 |
|------|------|--------|
| **Day 1** | 1 | 项目初始化、配置、健康检查 |
| **Day 2** | 1 | 认证插件、Core API 客户端 |
| **Day 3** | 1 | Dify 适配器、SSE 处理 |
| **Day 4** | 1 | 对话路由、授权/审计集成 |
| **Day 5** | 1 | 测试、Docker、文档 |

### 5.2 Day 1 详细任务

- [ ] 创建仓库、初始化 pnpm 项目
- [ ] 配置 TypeScript、ESLint、Prettier
- [ ] 实现配置加载 (`config/`)
- [ ] 实现 `app.ts` + `main.ts`
- [ ] 实现健康检查插件
- [ ] 验证基础启动

### 5.3 Day 2 详细任务

- [ ] 实现 `plugins/tracing.ts`
- [ ] 实现 `plugins/auth.ts`
- [ ] 实现 `plugins/rate-limit.ts`
- [ ] 实现 `services/core-api.ts`
- [ ] 单元测试：认证成功/失败

### 5.4 Day 3 详细任务

- [ ] 实现 `lib/sse.ts`
- [ ] 实现 `adapters/dify.ts`
- [ ] 实现请求转换逻辑
- [ ] 实现响应转换逻辑
- [ ] 集成测试：Mock Dify

### 5.5 Day 4 详细任务

- [ ] 实现 `plugins/authz.ts`
- [ ] 实现 `plugins/audit.ts`
- [ ] 实现 `routes/v1/chat.ts`
- [ ] 实现 `routes/v1/models.ts`
- [ ] E2E 测试：完整对话流程

### 5.6 Day 5 详细任务

- [ ] 补充单元测试覆盖率
- [ ] 编写 Dockerfile
- [ ] 编写 docker-compose.yml
- [ ] 编写 README.md
- [ ] 与主项目联调验证

---

## 6. 测试策略

### 6.1 测试覆盖

| 层级 | 目标覆盖率 | 工具 |
|------|-----------|------|
| 单元测试 | ≥ 80% | Vitest |
| 集成测试 | 核心路径 | Vitest + Supertest |
| E2E 测试 | Happy Path | Vitest |

### 6.2 Mock 策略

```typescript
// test/fixtures/mock-backend.ts
import { createServer } from 'http';

export function createMockDify(port = 5001) {
  return createServer((req, res) => {
    if (req.url === '/v1/chat-messages' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      
      // 模拟流式响应
      res.write('data: {"event":"message","answer":"Hello"}\n\n');
      res.write('data: {"event":"message","answer":" World"}\n\n');
      res.write('data: {"event":"message_end"}\n\n');
      res.end();
    }
  }).listen(port);
}
```

---

## 7. 与主项目集成

### 7.1 联调清单

- [ ] 主项目实现 `/internal/authz` 端点
- [ ] 主项目实现 `/internal/audit` 端点
- [ ] 确认 JWT 密钥共享方式
- [ ] 确认内部 Token 认证方式
- [ ] 前端集成 Gateway URL

### 7.2 环境变量

```bash
# Gateway
GATEWAY_PORT=4000
JWT_SECRET=<shared-with-core>
CORE_API_URL=http://localhost:3000
CORE_API_TOKEN=<internal-token>
DIFY_API_URL=http://your-dify-instance.com
DIFY_API_KEY=<dify-api-key>
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Core API 内部接口未就绪 | 阻塞 Day 2/4 | Mock Core API 响应 |
| Dify SSE 格式变化 | 适配器失效 | 详细阅读 Dify 文档，增加格式验证 |
| JWT 密钥共享方式 | 安全问题 | 使用 JWKS 或安全的密钥管理 |
| 流式响应性能 | 延迟增加 | 压测验证，优化 SSE 处理 |

---

## 附录 A：验收测试用例

```bash
# 1. 健康检查
curl http://localhost:4000/health
# → {"status":"ok"}

# 2. 无 Token 访问
curl -X POST http://localhost:4000/v1/chat/completions
# → 401 {"error":{"code":"invalid_token"}}

# 3. 有效对话（流式）
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"app_xxx","messages":[{"role":"user","content":"Hi"}],"stream":true}'
# → SSE stream

# 4. 停止生成
curl -X POST http://localhost:4000/v1/chat/completions/task_xxx/stop \
  -H "Authorization: Bearer <jwt>"
# → {"result":"success","stop_type":"hard"}
```

---

## 附录 B：版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v0.1 | 2026-01-27 | 初始 MVP 定义 |
