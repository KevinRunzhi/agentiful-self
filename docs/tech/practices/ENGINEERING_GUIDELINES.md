# AgentifUI 工程规范

* **规范版本**：v1.0
* **最后更新**：2026-01-27
* **状态**：已发布
* **适用范围**：AgentifUI 全栈开发

---

## 目录

1. [概述](#概述)
2. [TypeScript 规范](#typescript-规范)
3. [React 组件规范](#react-组件规范)
4. [API 调用规范](#api-调用规范)
5. [CSS 与样式规范](#css-与样式规范)
6. [Git 规范](#git-规范)
7. [Code Review 规范](#code-review-规范)

---

## 概述

### 核心原则

1. **一致性优先**：遵循规范比个人偏好更重要
2. **可读性优先**：代码是写给人看的，其次才是机器
3. **类型安全**：充分利用 TypeScript 的类型系统
4. **显式优于隐式**：明确的代码意图好于"聪明"的简写

### 工具链

| 工具 | 用途 | 配置文件 |
|------|------|----------|
| **TypeScript** | 类型检查 | `tsconfig.json` |
| **Oxlint** | 快速预检 Linter | `oxlint.json` |
| **ESLint** | 深度代码检查 | `eslint.config.mjs` |
| **Prettier** | 代码格式化 | `.prettierrc` |

> [!TIP]
> 采用 **Oxlint + ESLint 双层 Lint** 策略：Oxlint 作为快速预检（~100x faster），ESLint 作为深度检查。

---

## TypeScript 规范

### 基本配置

```json
// tsconfig.json 核心配置
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| **变量/函数** | camelCase | `userName`, `getUserById` |
| **常量** | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| **类/接口/类型** | PascalCase | `User`, `AuthResponse` |
| **枚举** | PascalCase（枚举值也用 PascalCase） | `enum Role { Admin, Member }` |
| **文件名** | kebab-case | `user-service.ts`, `login-form.tsx` |
| **组件文件** | kebab-case（或与组件名一致的 PascalCase） | `LoginForm.tsx` 或 `login-form.tsx` |

### 类型定义规范

```typescript
// ✅ 推荐：使用 interface 定义对象类型
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}

// ✅ 推荐：使用 type 定义联合类型、工具类型
type Status = 'pending' | 'active' | 'disabled';
type PartialUser = Partial<User>;

// ❌ 避免：使用 any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = response; // 不推荐

// ✅ 推荐：使用 unknown + 类型守卫
const data: unknown = response;
if (isUser(data)) {
  // data 在此作用域内是 User 类型
}
```

### 函数规范

```typescript
// ✅ 推荐：显式声明返回类型
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ 推荐：使用 async/await 而非 Promise.then
async function fetchUser(id: string): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

// ✅ 推荐：使用解构参数提高可读性
function createUser({
  email,
  name,
  role = Role.Member,
}: {
  email: string;
  name: string;
  role?: Role;
}): Promise<User> {
  // ...
}
```

### 空值处理

```typescript
// ✅ 推荐：使用可选链
const userName = user?.profile?.name;

// ✅ 推荐：使用空值合并
const displayName = user?.name ?? 'Anonymous';

// ❌ 避免：使用 || 进行空值合并（会误判 0、'' 为假值）
const count = data.count || 10; // 不推荐，data.count 为 0 时会错误使用 10
```

### 枚举规范

```typescript
// ✅ 推荐：使用 const enum 或字符串枚举
export const enum Role {
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Member = 'MEMBER',
  Viewer = 'VIEWER',
}

// ✅ 推荐：使用 as const 定义常量对象
export const ErrorCode = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
} as const;

type ErrorCodeType = keyof typeof ErrorCode;
```

---

## React 组件规范

### 组件结构

```tsx
// 推荐的组件文件结构
// components/login-form/index.tsx

import { useState, type FormEvent } from 'react';
import { useLogin } from '@/hooks/use-login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LoginFormProps } from './types';
import styles from './login-form.module.css';

// 1. 类型定义（或从 types.ts 导入）
interface LoginFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

// 2. 组件定义
export function LoginForm({ onSuccess, redirectUrl = '/' }: LoginFormProps) {
  // 3. Hooks（按 useState → useRef → 自定义 Hooks 顺序）
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useLogin();

  // 4. 事件处理函数
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      onSuccess?.();
    }
  };

  // 5. 渲染
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        disabled={isLoading}
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        disabled={isLoading}
      />
      {error && <p className={styles.error}>{error.message}</p>}
      <Button type="submit" loading={isLoading}>
        登录
      </Button>
    </form>
  );
}
```

### 组件命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| **页面组件** | `[Name]Page` | `LoginPage`, `DashboardPage` |
| **布局组件** | `[Name]Layout` | `AppLayout`, `AuthLayout` |
| **容器组件** | `[Name]Container` | `UserListContainer` |
| **展示组件** | 无后缀 | `LoginForm`, `UserCard` |
| **Hooks** | `use[Name]` | `useAuth`, `useLogin` |

### Props 规范

```tsx
// ✅ 推荐：使用 interface 定义 Props
interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 加载状态 */
  loading?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 子元素 */
  children: React.ReactNode;
}

// ✅ 推荐：使用 JSDoc 注释说明 Props
// 会在 Storybook 和 IDE 中显示

// ✅ 推荐：组件使用 Props 解构 + 默认值
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  // ...
}
```

### Hooks 规范

```typescript
// hooks/use-auth.ts

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';

export function useAuth() {
  // 查询当前用户
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
  });

  // 登出
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // 清理缓存、跳转等
    },
  });

  // 派生状态使用 useMemo
  const isAuthenticated = useMemo(() => !!user && !error, [user, error]);

  // 回调函数使用 useCallback
  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
```

### 状态管理（Zustand）

```typescript
// store/user/store.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User } from '@/types';

interface UserState {
  // State
  user: User | null;
  preferences: UserPreferences;

  // Actions
  setUser: (user: User | null) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  preferences: { theme: 'system', locale: 'zh-CN' },
};

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setUser: (user) => set({ user }),

        updatePreferences: (prefs) =>
          set((state) => ({
            preferences: { ...state.preferences, ...prefs },
          })),

        reset: () => set(initialState),
      }),
      { name: 'user-store' }
    ),
    { name: 'UserStore' }
  )
);

// 选择器（避免不必要的重渲染）
export const selectUser = (state: UserState) => state.user;
export const selectPreferences = (state: UserState) => state.preferences;
```

---

## API 调用规范

### API Client 结构

```typescript
// api/client.ts

import { ofetch } from 'ofetch';
import { useAuthStore } from '@/store/auth';

export const apiClient = ofetch.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  
  onRequest: ({ options }) => {
    // 注入 Auth Token
    const token = useAuthStore.getState().accessToken;
    if (token) {
      options.headers.set('Authorization', `Bearer ${token}`);
    }
    
    // 注入 Trace ID
    options.headers.set('X-Trace-ID', generateTraceId());
  },
  
  onResponseError: async ({ response }) => {
    // 统一错误处理
    if (response.status === 401) {
      // Token 过期，尝试刷新或跳转登录
    }
  },
});
```

### API 模块定义

```typescript
// api/auth.ts

import { apiClient } from './client';
import type { LoginRequest, LoginResponse, User } from '@/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient('/auth/login', {
      method: 'POST',
      body: data,
    });
  },

  logout: async (): Promise<void> => {
    return apiClient('/auth/logout', {
      method: 'POST',
    });
  },

  getMe: async (): Promise<User> => {
    return apiClient('/auth/me');
  },
};
```

### 错误处理

```typescript
// ✅ 推荐：使用统一的错误类型
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ✅ 推荐：在 Hook 中处理错误
export function useLogin() {
  const mutation = useMutation({
    mutationFn: authApi.login,
    onError: (error: ApiError) => {
      // 根据错误码显示不同提示
      switch (error.code) {
        case 'AUTH_INVALID_CREDENTIALS':
          toast.error('邮箱或密码不正确');
          break;
        case 'AUTH_ACCOUNT_LOCKED':
          toast.error('账户已锁定，请 30 分钟后重试');
          break;
        default:
          toast.error(error.message);
      }
    },
  });

  return mutation;
}
```

### Loading 状态处理

```tsx
// ✅ 推荐：使用统一的 Loading 组件
function UserList() {
  const { data, isLoading, error } = useUsers();

  if (isLoading) {
    return <Skeleton count={5} />;
  }

  if (error) {
    return <ErrorState error={error} retry={refetch} />;
  }

  if (!data?.length) {
    return <EmptyState message="暂无用户" />;
  }

  return (
    <ul>
      {data.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </ul>
  );
}
```

---

## CSS 与样式规范

### 使用 Tailwind CSS

```tsx
// ✅ 推荐：使用 Tailwind 工具类
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
  提交
</button>

// ✅ 推荐：使用 cn 工具函数合并类名
import { cn } from '@/lib/utils';

<button className={cn(
  'px-4 py-2 rounded-md',
  variant === 'primary' && 'bg-primary text-primary-foreground',
  variant === 'outline' && 'border border-input bg-background',
  disabled && 'opacity-50 cursor-not-allowed'
)}>
  {children}
</button>
```

### 设计令牌引用

```css
/* ✅ 推荐：使用设计系统定义的 CSS 变量 */
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: var(--spacing-4);
}

/* ❌ 避免：硬编码颜色值 */
.card {
  background: #ffffff; /* 不推荐 */
  border-radius: 8px; /* 不推荐 */
}
```

### CSS 模块（仅当 Tailwind 不够用时）

```tsx
// components/login-form/login-form.module.css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

// components/login-form/index.tsx
import styles from './login-form.module.css';

<form className={styles.form}>
```

### 响应式设计

```tsx
// ✅ 推荐：使用 Tailwind 响应式前缀
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// 断点参考（来自 DESIGN_SYSTEM_P1.md）
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
```

---

## Git 规范

### 分支策略

| 分支类型 | 命名格式 | 示例 | 说明 |
|----------|----------|------|------|
| **主分支** | `main` | - | 生产分支 |
| **开发分支** | `develop` | - | 开发集成分支 |
| **功能分支** | `feature/[slice]-[module]` | `feature/s1-auth` | 功能开发 |
| **修复分支** | `fix/[slice]-[issue]` | `fix/s1-login-error` | Bug 修复 |
| **规范分支** | `spec/[name]-v[version]` | `spec/gateway-v0.2` | 规范变更 |

### Commit Message 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
[切片ID] <type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `[S1] feat(auth): add login form` |
| `fix` | Bug 修复 | `[S1] fix(auth): resolve token refresh race` |
| `docs` | 文档变更 | `docs: update README` |
| `style` | 代码格式（不影响逻辑）| `style: format code with prettier` |
| `refactor` | 代码重构 | `[S2] refactor(chat): extract message slice` |
| `test` | 测试相关 | `[S1] test(auth): add login e2e tests` |
| `chore` | 构建/工具相关 | `chore: update dependencies` |
| `perf` | 性能优化 | `[S2] perf(chat): optimize SSE connection` |

**示例**：

```bash
# 好的 Commit Message
[S1] feat(auth): implement email password login

- Add LoginForm component with validation
- Integrate with better-auth API
- Add loading and error states

Closes #123

# 不好的 Commit Message
fix bug        # 太简略
更新代码       # 不够具体
wip            # 不应提交 WIP
```

### PR 规范

**PR 标题格式**：

```
[S1] feat(auth): implement login page
```

**PR 模板**：

```markdown
## 变更类型
- [x] 功能实现
- [ ] Bug 修复
- [ ] 规范变更

## 关联
- 切片: S1
- Feature ID: F-AUTH-001
- FRD: [链接]

## 变更内容
简述本次变更的内容...

## AI 产出校验
- [x] 通过 FRD 校验清单
- [x] 通过代码校验清单

## 测试
- [x] 单元测试通过
- [x] E2E 测试通过

## 截图（如有 UI 变更）
...
```

---

## Code Review 规范

### Review 检查清单

#### 代码质量

- [ ] 代码符合 TypeScript/React 规范
- [ ] 无明显的逻辑错误
- [ ] 无硬编码的配置值
- [ ] 错误处理完善
- [ ] 无内存泄漏风险（Event Listener 清理等）

#### 架构合规

- [ ] 目录结构符合 `REPO_STRUCTURE.md`
- [ ] API 契约符合 `GATEWAY_CONTRACT_P1.md`
- [ ] 审计事件符合 `AUDIT_EVENTS_P1.md`
- [ ] 设计令牌符合 `DESIGN_SYSTEM_P1.md`

#### 可维护性

- [ ] 命名清晰、有意义
- [ ] 复杂逻辑有注释
- [ ] 组件职责单一
- [ ] 无重复代码

#### 测试

- [ ] 核心逻辑有单元测试
- [ ] E2E 测试覆盖 FRD 中的 AC
- [ ] 测试用例有意义（不只是覆盖率）

#### 安全

- [ ] 无敏感信息泄露
- [ ] 输入有校验
- [ ] 权限检查正确

### Review 礼仪

**Reviewer**：

- 及时响应（48h 内）
- 评论明确、建设性
- 区分 "必须改" 和 "建议改"
- 肯定好的设计

**Author**：

- PR 保持小而专注
- 主动提供上下文
- 及时响应 Review 意见
- 不要 Force Push 已有评论的提交

### Review 状态

| 状态 | 含义 |
|------|------|
| **Approve** | 代码没问题，可以合并 |
| **Request Changes** | 有必须修改的问题 |
| **Comment** | 有疑问或建议，但不阻塞合并 |

---

## 附录：Lint 配置示例

### ESLint 配置

```javascript
// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat();

export default tseslint.config(
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### Prettier 配置

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

*文档结束*
