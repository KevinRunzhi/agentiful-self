# AgentifUI 测试策略

* **规范版本**：v1.0
* **最后更新**：2026-01-27
* **状态**：已发布
* **参考**：Jest 30 / Playwright / React Testing Library

---

## 目录

1. [概述](#概述)
2. [测试金字塔](#测试金字塔)
3. [单元测试规范](#单元测试规范)
4. [集成测试规范](#集成测试规范)
5. [E2E 测试规范](#e2e-测试规范)
6. [测试工具链](#测试工具链)
7. [CI/CD 集成](#cicd-集成)
8. [测试命名与组织](#测试命名与组织)

---

## 概述

### 测试原则

1. **先写测试**：TDD 或 测试先行，确保明确期望行为
2. **测试行为而非实现**：测试用户视角的行为，而非内部实现细节
3. **快速反馈**：单元测试应快速执行，E2E 测试聚焦关键路径
4. **可维护性**：测试代码同样需要良好的结构和可读性

### 与 FRD 的关系

- **FRD AC（验收标准）** → **E2E 测试用例**
- **FRD 数据契约** → **集成测试用例**
- **组件行为** → **单元测试用例**

---

## 测试金字塔

```
        ▲
       /E\         E2E 测试（Playwright）
      /2E \        - 关键用户流程
     /-----\       - 数量少、执行慢
    /  集成  \      集成测试
   /  测试   \     - API 契约
  /-----------\    - 数据库交互
 /   单元测试   \   单元测试（Jest）
/_______________\  - 组件、Hooks、工具函数
                   - 数量多、执行快
```

### 各层测试比例

| 测试类型 | 比例 | 执行时间 | 关注点 |
|----------|------|----------|--------|
| **单元测试** | ~70% | < 1s/test | 函数、组件、Hooks |
| **集成测试** | ~20% | < 5s/test | API、数据库、服务交互 |
| **E2E 测试** | ~10% | < 30s/test | 关键用户流程 |

---

## 单元测试规范

### 覆盖率要求

| 指标 | 最低要求 | 目标 |
|------|----------|------|
| **语句覆盖率 (Statements)** | 70% | 80% |
| **分支覆盖率 (Branches)** | 60% | 75% |
| **函数覆盖率 (Functions)** | 70% | 85% |
| **行覆盖率 (Lines)** | 70% | 80% |

> [!IMPORTANT]
> 核心业务逻辑（如权限判定、配额计算）覆盖率应 ≥ 90%。

### 测试框架

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'happy-dom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};

export default config;
```

### 工具函数测试

```typescript
// lib/utils.test.ts
import { describe, it, expect } from '@jest/globals';
import { cn, formatDate, calculateQuota } from './utils';

describe('cn', () => {
  it('合并多个类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('过滤 falsy 值', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('合并 Tailwind 类名并去重', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('calculateQuota', () => {
  it('计算剩余配额', () => {
    const result = calculateQuota({
      limit: 10000,
      used: 3500,
    });
    expect(result.remaining).toBe(6500);
    expect(result.percentage).toBe(35);
  });

  it('超出配额时返回 0', () => {
    const result = calculateQuota({
      limit: 1000,
      used: 1500,
    });
    expect(result.remaining).toBe(0);
    expect(result.exceeded).toBe(true);
  });
});
```

### React 组件测试

```typescript
// components/button/button.test.tsx
import { describe, it, expect, vi } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('渲染按钮文本', () => {
    render(<Button>提交</Button>);
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
  });

  it('点击时触发 onClick', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>点击</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('禁用状态下不触发 onClick', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>禁用</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('加载状态显示 Spinner', () => {
    render(<Button loading>加载中</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
```

### Hooks 测试

```typescript
// hooks/use-auth.test.ts
import { describe, it, expect, vi, beforeEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { authApi } from '@/api/auth';

// Mock API
vi.mock('@/api/auth');

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始状态为 loading', () => {
    vi.mocked(authApi.getMe).mockReturnValue(new Promise(() => {}));
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeUndefined();
  });

  it('获取用户成功后更新状态', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('登出清除用户状态', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      result.current.logout();
    });
    
    expect(authApi.logout).toHaveBeenCalled();
  });
});
```

### Mock 规范

```typescript
// __mocks__/api/auth.ts
export const authApi = {
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  refreshToken: vi.fn(),
};

// 测试文件中使用
vi.mock('@/api/auth');

beforeEach(() => {
  // 重置 mock
  vi.clearAllMocks();
  
  // 设置默认行为
  vi.mocked(authApi.getMe).mockResolvedValue(null);
});

it('测试特定场景', () => {
  // 覆盖默认行为
  vi.mocked(authApi.login).mockResolvedValue({
    accessToken: 'token',
    user: mockUser,
  });
  
  // ... 测试逻辑
});
```

---

## 集成测试规范

### API 契约测试

```typescript
// api/auth.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from '@/server';
import type { FastifyInstance } from 'fastify';

describe('Auth API', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /auth/login', () => {
    it('成功登录返回 token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: {
          id: expect.any(String),
          email: 'test@example.com',
        },
      });
    });

    it('错误密码返回 401', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: expect.any(String),
        },
      });
    });

    it('无效邮箱返回 400', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'invalid-email',
          password: 'ValidPass123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
```

### 数据库测试

```typescript
// db/user.integration.test.ts
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { db } from '@/db';
import { users, groups } from '@/db/schema';
import { createUser, getUserById } from '@/services/user';

describe('User Service', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.delete(users);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('创建用户并分配到默认群组', async () => {
    const user = await createUser({
      email: 'new@example.com',
      name: 'New User',
      tenantId: 'tenant-1',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('new@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);

    // 验证数据库中确实创建了记录
    const dbUser = await getUserById(user.id);
    expect(dbUser).toEqual(user);
  });

  it('重复邮箱抛出错误', async () => {
    await createUser({
      email: 'duplicate@example.com',
      name: 'First',
      tenantId: 'tenant-1',
    });

    await expect(
      createUser({
        email: 'duplicate@example.com',
        name: 'Second',
        tenantId: 'tenant-1',
      })
    ).rejects.toThrow('EMAIL_ALREADY_EXISTS');
  });
});
```

---

## E2E 测试规范

### Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E 测试用例

```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('用户登录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('正常登录流程', async ({ page }) => {
    // FRD AC-1: 用户输入正确邮箱密码后，成功登录并跳转到首页
    await page.getByLabel('邮箱').fill('test@example.com');
    await page.getByLabel('密码').fill('ValidPass123');
    await page.getByRole('button', { name: '登录' }).click();

    // 验证跳转
    await expect(page).toHaveURL('/');
    await expect(page.getByText('欢迎')).toBeVisible();
  });

  test('密码错误显示错误提示', async ({ page }) => {
    // FRD AC-2: 用户输入错误密码后，显示错误提示
    await page.getByLabel('邮箱').fill('test@example.com');
    await page.getByLabel('密码').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page.getByText('邮箱或密码不正确')).toBeVisible();
    await expect(page).toHaveURL('/login'); // 保持在登录页
  });

  test('账户锁定提示', async ({ page }) => {
    // FRD AC-3: 连续 5 次错误后账户锁定
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('邮箱').fill('locked@example.com');
      await page.getByLabel('密码').fill('wrong');
      await page.getByRole('button', { name: '登录' }).click();
    }

    await expect(page.getByText('账户已锁定')).toBeVisible();
  });

  test('记住我延长会话', async ({ page }) => {
    // FRD AC-4: 勾选"记住我"后，Session 有效期延长
    await page.getByLabel('邮箱').fill('test@example.com');
    await page.getByLabel('密码').fill('ValidPass123');
    await page.getByLabel('记住我').check();
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page).toHaveURL('/');
    
    // 验证 Cookie 过期时间
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');
    expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 6 * 24 * 3600);
  });
});
```

### Page Object 模式

```typescript
// e2e/pages/login.page.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('邮箱');
    this.passwordInput = page.getByLabel('密码');
    this.rememberMeCheckbox = page.getByLabel('记住我');
    this.submitButton = page.getByRole('button', { name: '登录' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

// 使用 Page Object
// e2e/auth/login.spec.ts
import { LoginPage } from '../pages/login.page';

test('使用 Page Object', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'wrong');
  await loginPage.expectError('邮箱或密码不正确');
});
```

---

## 测试工具链

### 工具清单

| 工具 | 用途 | 版本 |
|------|------|------|
| **Jest** | 单元测试 / 集成测试 | 30 |
| **React Testing Library** | React 组件测试 | - |
| **happy-dom** | DOM 模拟环境 | - |
| **Playwright** | E2E 测试 | - |
| **MSW** | API Mock | - |

### 安装命令

```bash
# 单元测试 + 集成测试
pnpm add -D jest @jest/globals ts-jest @types/jest
pnpm add -D @testing-library/react @testing-library/jest-dom
pnpm add -D happy-dom

# E2E 测试
pnpm add -D @playwright/test
npx playwright install

# API Mock（可选）
pnpm add -D msw
```

### 测试命令

```bash
# 运行所有单元测试
pnpm test

# 运行并监听变化
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# 运行 E2E 测试
pnpm test:e2e

# 运行 E2E 测试（带 UI）
pnpm test:e2e:ui

# 特定文件
pnpm test auth.test.ts
pnpm test:e2e login.spec.ts
```

---

## CI/CD 集成

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - run: pnpm install
      - run: npx playwright install --with-deps
      
      - name: Start services
        run: docker-compose up -d db redis
      
      - run: pnpm test:e2e
      
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

### 覆盖率门禁

```yaml
# PR 合并要求
- 单元测试覆盖率 ≥ 70%
- 关键模块覆盖率 ≥ 90%
- 所有 E2E 测试通过
- 无 TypeScript 错误
- Lint 通过
```

---

## 测试命名与组织

### 文件命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| **单元测试** | `*.test.ts(x)` | `button.test.tsx` |
| **集成测试** | `*.integration.test.ts` | `auth.integration.test.ts` |
| **E2E 测试** | `*.spec.ts` | `login.spec.ts` |

### 目录结构

```
project/
├── src/
│   ├── components/
│   │   └── button/
│   │       ├── button.tsx
│   │       ├── button.test.tsx      # 单元测试
│   │       └── button.stories.tsx   # Storybook
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   └── use-auth.test.ts
│   └── api/
│       ├── auth.ts
│       └── auth.integration.test.ts # 集成测试
├── e2e/                              # E2E 测试
│   ├── pages/                        # Page Objects
│   │   └── login.page.ts
│   ├── auth/
│   │   └── login.spec.ts
│   ├── chat/
│   │   └── conversation.spec.ts
│   └── fixtures/                     # 测试数据
│       └── users.json
└── __mocks__/                        # 全局 Mock
    └── api/
        └── auth.ts
```

### 测试描述规范

```typescript
// ✅ 推荐：使用中文描述
describe('LoginForm 组件', () => {
  describe('表单校验', () => {
    it('邮箱为空时显示错误提示', () => { });
    it('密码少于 8 位时显示错误提示', () => { });
  });

  describe('提交行为', () => {
    it('提交时显示加载状态', () => { });
    it('成功后触发 onSuccess 回调', () => { });
    it('失败后显示错误信息', () => { });
  });
});

// ❌ 避免：含糊不清的描述
describe('LoginForm', () => {
  it('works', () => { });          // 不明确
  it('test error', () => { });     // 不明确
  it('should work correctly', () => { });  // 太笼统
});
```

---

## 附录 A：测试速查表

### 常用断言

```typescript
// 值断言
expect(value).toBe(expected);           // 严格相等
expect(value).toEqual(expected);        // 深度相等
expect(value).toBeTruthy();             // 真值
expect(value).toBeNull();               // null
expect(value).toBeUndefined();          // undefined
expect(value).toBeDefined();            // 已定义

// 对象断言
expect(obj).toMatchObject({ key: val }); // 部分匹配
expect(obj).toHaveProperty('key');       // 有属性
expect(arr).toContain(item);             // 包含元素
expect(arr).toHaveLength(3);             // 长度

// 异步断言
await expect(promise).resolves.toBe(val);
await expect(promise).rejects.toThrow('error');

// Mock 断言
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg);
expect(mockFn).toHaveBeenCalledTimes(2);
```

### RTL 查询优先级

```typescript
// 优先级从高到低
getByRole('button', { name: '提交' })  // 1. 无障碍角色
getByLabelText('邮箱')                  // 2. 表单标签
getByPlaceholderText('请输入')          // 3. 占位符
getByText('欢迎')                       // 4. 文本内容
getByDisplayValue('值')                 // 5. 表单值
getByAltText('描述')                    // 6. Alt 文本
getByTitle('标题')                      // 7. Title 属性
getByTestId('custom-id')                // 8. test-id（最后手段）
```

---

*文档结束*
