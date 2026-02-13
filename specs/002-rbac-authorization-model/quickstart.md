# Quickstart Guide: RBAC Authorization Model (S1-2)

**Feature**: 002-rbac-authorization-model
**Created**: 2025-02-11
**Prerequisites**: S1-1 多租户身份认证基座已完成

---

## Overview

本文档提供 S1-2 切片（RBAC 授权模型）的开发环境快速配置指南，包括数据库设置、种子数据、本地验证等。

---

## 1. 环境准备

### 1.1 前置条件

- Node.js 22.x LTS
- pnpm 10.x
- PostgreSQL 18
- Redis 7.x

### 1.2 安装依赖

```bash
# 安装 Monorepo 依赖
pnpm install

# 安装特定包依赖
pnpm --filter @agentifui/db install
pnpm --filter @agentifui/api install
pnpm --filter @agentifui/web install
```

---

## 2. 数据库配置

### 2.1 创建数据库

```bash
# 使用 psql 创建数据库
createdb agentiful

# 或使用 Docker
docker run -d \
  --name agentiful-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agentiful \
  -p 5432:5432 \
  postgres:18-alpine
```

### 2.2 配置环境变��

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
```

```env
# .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentiful
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
```

### 2.3 运行数据库迁移

```bash
# 生成 Drizzle 迁移文件
pnpm --filter @agentifui/db db:generate

# 执行迁移
pnpm --filter @agentifui/db db:migrate

# 或使用 Drizzle Kit
pnpm --filter @agentifui/db db:push
```

### 2.4 加载种子数据

```bash
# 加载 RBAC 种子数据
pnpm --filter @agentifui/db seed:rbac
```

种子数据包括：
- 3 个预置角色（root_admin, tenant_admin, user）
- 9 个核心权限
- 角色-权限关联（Tenant Admin 拥有全部权限，User 拥有 app:use）

---

## 3. 启动开发服务器

### 3.1 启动后端 API

```bash
pnpm --filter @agentifui/api dev
# 服务运行在 http://localhost:3001
```

### 3.2 启动前端 Web

```bash
pnpm --filter @agentifui/web dev
# 服务运行在 http://localhost:3000
```

### 3.3 启动 Worker（可选）

```bash
pnpm --filter @agentifui/worker dev
```

---

## 4. 本地验证

### 4.1 验证数据库表

```bash
# 使用 psql 连接数据库
psql postgres://postgres:postgres@localhost:5432/agentiful

# 检查表是否创建
\dt

# 应该看到以下新表：
# - roles
# - permissions
# - role_permissions
# - user_roles
# - app_grants
```

### 4.2 验证种子数据

```sql
-- 查询预置角色
SELECT * FROM roles;

-- 查询权限
SELECT * FROM permissions;

-- 查询角色权限关联
SELECT r.name, p.code FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id;
```

### 4.3 测试 API 接口

```bash
# 1. 登录获取 Token
curl -X POST http://localhost:3001/api/auth/signin/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'

# 2. 检查权限
curl -X POST http://localhost:3001/api/v1/permissions/check \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"resourceType": "app", "action": "use"}'

# 3. 创建授权
curl -X POST http://localhost:3001/api/v1/grants \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app-uuid",
    "granteeType": "group",
    "granteeId": "group-uuid",
    "permission": "use"
  }'
```

### 4.4 测试权限判定性能

```bash
# 使用 Apache Bench 测试
ab -n 1000 -c 10 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -p check-permission.json \
  http://localhost:3001/api/v1/permissions/check

# P95 应该 ≤ 50ms
```

---

## 5. 开发工具

### 5.1 数据库客户端

```bash
# 使用 Drizzle Studio
pnpm --filter @agentifui/db studio

# 或使用 TablePlus、DBeaver 等 GUI 工具
```

### 5.2 Redis 客户端

```bash
# 使用 Redis CLI
redis-cli

# 查看权限缓存
KEYS perm:*

# 查看特定缓存
GET perm:user-uuid:tenant-uuid
```

### 5.3 日志查看

```bash
# API 日志
tail -f apps/api/logs/combined.log

# 或使用 pino-pretty
pnpm --filter @agentifui/api dev | pino-pretty
```

---

## 6. 调试技巧

### 6.1 启用 ROOT ADMIN

```bash
# 设置环境变量
export ENABLE_ROOT_ADMIN=true

# 或在 .env 文件中添加
echo "ENABLE_ROOT_ADMIN=true" >> .env
```

### 6.2 创建 ROOT ADMIN 用户

```bash
# 使用 CLI 创建
pnpm --filter @agentifui/db cli:create-root-admin \
  --email admin@platform.com \
  --password Admin123!
```

### 6.3 查看 Trace ID

```bash
# 响应头中包含 Trace ID
curl -v http://localhost:3001/api/v1/permissions/check \
  -H "Authorization: Bearer {token}" \
  -H "X-Trace-ID: test-trace-123"

# 日志中搜索 Trace ID
grep "test-trace-123" apps/api/logs/combined.log
```

---

## 7. 常见问题

### Q1: 数据库迁移失败

```bash
# 重置数据库
pnpm --filter @agentifui/db db:drop
pnpm --filter @agentifui/db db:push

# 重新加载种子数据
pnpm --filter @agentifui/db seed:rbac
```

### Q2: Redis 连接失败

```bash
# 检查 Redis 是否运行
redis-cli ping

# 启动 Redis
docker run -d --name agentiful-redis -p 6379:6379 redis:7-alpine
```

### Q3: 权限判定返回 403

1. 检查 Token 是否有效
2. 检查用户是否有角色分配
3. 检查应用是否已授权
4. 查看 Trace ID 追踪完整调用链

---

## 8. 下一步

- 阅读完整的 [data-model.md](./data-model.md)
- 查看 API 契约 [contracts/rbac-api.md](./contracts/rbac-api.md)
- 运行测试：`pnpm test`
- 开始开发：参考 [plan.md](./plan.md)

---

*本文档基于 .specify/templates/plan-template.md 生成*
