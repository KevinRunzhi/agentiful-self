# Quickstart: S1-3 应用入口与工作台

## 1. 目标

本快速指南用于本地验证 S1-3 核心路径：

1. 用户能看到授权应用列表。  
2. 搜索与收藏可用。  
3. 配额检查可拦截超限请求。  
4. 配额服务异常时触发降级（可浏览、禁新建）。

## 2. 前置条件

- Node.js 22.x  
- `pnpm`（Windows 推荐使用 `pnpm.cmd`）  
- PostgreSQL 与 Redis 可用  
- 已有 S1-1/S1-2 基础数据（租户、用户、群组、授权）

## 3. 启动

```powershell
pnpm.cmd install
pnpm.cmd --filter @agentifui/db migrate
pnpm.cmd --filter @agentifui/api dev
pnpm.cmd --filter @agentifui/web dev
```

## 4. 验证步骤

### 4.1 工作台入口

1. 登录用户。  
2. 打开 `/apps`。  
3. 验证只出现授权应用（无权应用不可见）。

### 4.2 搜索与分类

1. 在应用页输入关键词。  
2. 切换 `Recent / Favorites / All`。  
3. 验证查询返回与视图一致。

### 4.3 配额拦截

1. 调低用户或群组配额。  
2. 发起新对话请求。  
3. 观察返回 `quota_exceeded` 并包含 traceId。

### 4.4 降级演练

1. 暂停 quota service（或注入故障开关）。  
2. 刷新 `/apps`，确认可进入。  
3. 点击“新对话”，确认被禁止并有降级提示。

## 5. 回归清单

- S1-2 的 `GET /apps/accessible` 与 `GET /apps/:id/context-options` 不回退。  
- 多群组归因仍以 `X-Active-Group-ID` 生效。  
- 审计事件写入正常（超限、告警、降级）。
