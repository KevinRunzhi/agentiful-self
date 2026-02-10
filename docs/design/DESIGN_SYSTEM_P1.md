# AgentifUI 设计系统基线规范

> **版本**：v0.1  
> **最后更新**：2026-01-27  
> **状态**：草稿  
> **适用范围**：Phase 1 所有切片

---

## 概述

本文档定义 AgentifUI 的设计系统基线规范，作为 Phase 1 所有 FRD 和前端实现的设计约束。所有 UI 实现必须引用本规范版本号。

### 设计原则

1. **一致性**：所有界面元素遵循统一的视觉语言
2. **可访问性**：满足 WCAG 2.1 AA 标准
3. **响应式**：支持桌面、平板、移动端三种视口
4. **AI-Native**：为 AI 对话场景优化的交互模式

---

## 设计令牌（Design Tokens）

### 颜色系统

#### 品牌色

| Token | Light Mode | Dark Mode | 用途 |
|-------|------------|-----------|------|
| `--color-primary` | `#6366F1` | `#818CF8` | 主要操作、链接 |
| `--color-primary-hover` | `#4F46E5` | `#A5B4FC` | 主要操作悬停 |
| `--color-primary-active` | `#4338CA` | `#6366F1` | 主要操作激活 |

#### 语义色

| Token | Light Mode | Dark Mode | 用途 |
|-------|------------|-----------|------|
| `--color-success` | `#10B981` | `#34D399` | 成功状态 |
| `--color-warning` | `#F59E0B` | `#FBBF24` | 警告状态 |
| `--color-error` | `#EF4444` | `#F87171` | 错误状态 |
| `--color-info` | `#3B82F6` | `#60A5FA` | 信息提示 |

#### 中性色

| Token | Light Mode | Dark Mode | 用途 |
|-------|------------|-----------|------|
| `--color-bg-primary` | `#FFFFFF` | `#0F172A` | 主背景 |
| `--color-bg-secondary` | `#F8FAFC` | `#1E293B` | 次级背景 |
| `--color-bg-tertiary` | `#F1F5F9` | `#334155` | 卡片/容器背景 |
| `--color-border` | `#E2E8F0` | `#475569` | 边框 |
| `--color-text-primary` | `#0F172A` | `#F8FAFC` | 主文字 |
| `--color-text-secondary` | `#64748B` | `#94A3B8` | 次级文字 |
| `--color-text-tertiary` | `#94A3B8` | `#64748B` | 占位符/禁用 |

### 字体系统

#### 字体族

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

#### 字号比例

| Token | Size | Line Height | 用途 |
|-------|------|-------------|------|
| `--text-xs` | 12px | 16px | 辅助文字、标签 |
| `--text-sm` | 14px | 20px | 次级文字、表格 |
| `--text-base` | 16px | 24px | 正文 |
| `--text-lg` | 18px | 28px | 小标题 |
| `--text-xl` | 20px | 28px | 卡片标题 |
| `--text-2xl` | 24px | 32px | 页面标题 |
| `--text-3xl` | 30px | 36px | 大标题 |

#### 字重

| Token | Weight | 用途 |
|-------|--------|------|
| `--font-normal` | 400 | 正文 |
| `--font-medium` | 500 | 强调 |
| `--font-semibold` | 600 | 标题 |
| `--font-bold` | 700 | 重要标题 |

### 间距系统

采用 4px 为基数的间距比例：

| Token | Value | 用途 |
|-------|-------|------|
| `--space-1` | 4px | 最小间距 |
| `--space-2` | 8px | 紧凑间距 |
| `--space-3` | 12px | 小间距 |
| `--space-4` | 16px | 标准间距 |
| `--space-5` | 20px | 中等间距 |
| `--space-6` | 24px | 大间距 |
| `--space-8` | 32px | 区块间距 |
| `--space-10` | 40px | 大区块间距 |
| `--space-12` | 48px | 页面级间距 |
| `--space-16` | 64px | 最大间距 |

### 圆角

| Token | Value | 用途 |
|-------|-------|------|
| `--radius-sm` | 4px | 小元素（标签、徽章） |
| `--radius-md` | 6px | 输入框、按钮 |
| `--radius-lg` | 8px | 卡片、模态框 |
| `--radius-xl` | 12px | 大卡片 |
| `--radius-2xl` | 16px | 特殊容器 |
| `--radius-full` | 9999px | 圆形（头像、标签） |

### 阴影

| Token | Value | 用途 |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 微弱阴影 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | 卡片阴影 |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | 弹出层阴影 |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | 模态框阴影 |

### 动画

| Token | Value | 用途 |
|-------|-------|------|
| `--duration-fast` | 150ms | 微交互 |
| `--duration-normal` | 250ms | 标准过渡 |
| `--duration-slow` | 350ms | 复杂动画 |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | 标准缓动 |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | 进入 |
| `--easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | 退出 |

---

## 响应式断点

| Breakpoint | Min Width | 典型设备 |
|------------|-----------|----------|
| `sm` | 640px | 大手机 |
| `md` | 768px | 平板竖屏 |
| `lg` | 1024px | 平板横屏 / 小笔记本 |
| `xl` | 1280px | 桌面 |
| `2xl` | 1536px | 大桌面 |

**设计稿基准**：1440px（桌面）、768px（平板）、375px（移动）

---

## 组件规范

### Button（按钮）

#### 变体

| Variant | 用途 | 样式描述 |
|---------|------|----------|
| `primary` | 主要操作 | 实心品牌色背景 |
| `secondary` | 次要操作 | 描边样式 |
| `ghost` | 低优先级操作 | 透明背景，悬停显色 |
| `destructive` | 危险操作 | 红色系 |

#### 尺寸

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| `sm` | 32px | 12px 16px | 14px |
| `md` | 40px | 12px 20px | 14px |
| `lg` | 48px | 16px 24px | 16px |

#### 状态

| State | 说明 |
|-------|------|
| Default | 默认状态 |
| Hover | 鼠标悬停，亮度变化 |
| Active/Pressed | 按下，亮度进一步变化 |
| Focused | 键盘聚焦，显示 focus ring |
| Disabled | 禁用，降低透明度，cursor: not-allowed |
| Loading | 加载中，显示 Spinner，禁用点击 |

### Input（输入框）

#### 变体

| Variant | 用途 |
|---------|------|
| `default` | 标准输入框 |
| `error` | 校验失败状态 |
| `success` | 校验成功状态 |

#### 尺寸

| Size | Height | Font Size |
|------|--------|-----------|
| `sm` | 32px | 14px |
| `md` | 40px | 14px |
| `lg` | 48px | 16px |

#### 必备元素

- Label（标签）：必须，置于输入框上方
- Placeholder（占位符）：可选，使用 `--color-text-tertiary`
- Helper Text（帮助文字）：可选，置于输入框下方
- Error Message（错误信息）：校验失败时显示，替代 Helper Text

### Card（卡片）

| 元素 | 规范 |
|------|------|
| 背景 | `--color-bg-tertiary` |
| 边框 | `1px solid --color-border` 或无边框 |
| 圆角 | `--radius-lg` |
| 内边距 | `--space-6` |
| 阴影 | `--shadow-md`（可选） |

### Modal（模态框）

| 元素 | 规范 |
|------|------|
| 遮罩 | `rgba(0, 0, 0, 0.5)`，点击可关闭（可配置） |
| 容器宽度 | `sm`: 400px, `md`: 540px, `lg`: 720px |
| 圆角 | `--radius-xl` |
| 阴影 | `--shadow-xl` |
| 动画 | 淡入 + 缩放，duration: `--duration-normal` |

---

## 通用状态规范

所有涉及异步操作的界面必须覆盖以下 4 种状态：

### Loading（加载中）

| 场景 | UI 表现 |
|------|---------|
| 全页加载 | 居中 Spinner + 文字提示 |
| 按钮提交 | 按钮内 Spinner，按钮禁用 |
| 列表加载 | Skeleton 骨架屏 |
| 增量加载 | 底部 Spinner |

### Empty（空状态）

| 场景 | UI 表现 |
|------|---------|
| 列表为空 | 插图 + 文字说明 + 操作按钮（可选） |
| 搜索无结果 | 插图 + "未找到结果" + 建议操作 |

### Error（错误状态）

| 场景 | UI 表现 |
|------|---------|
| 表单校验失败 | 输入框红色边框 + 错误信息 |
| 请求失败 | Toast 提示 / 内联错误卡片 + 重试按钮 |
| 页面加载失败 | 错误插图 + 错误描述 + 重试/返回按钮 |

**错误信息规范**：
- 使用用户可理解的语言，避免技术术语
- 提供可操作的建议（如"请重试"或"联系管理员"）
- 严重错误需包含 Trace ID 供排障

### Success（成功状态）

| 场景 | UI 表现 |
|------|---------|
| 操作成功 | Toast 提示（自动消失，3-5秒） |
| 表单提交成功 | 成功页面 / 跳转 + Toast |

---

## AI 对话场景专用规范

### 消息气泡

| 类型 | 样式 |
|------|------|
| 用户消息 | 右对齐，品牌色背景，白色文字 |
| AI 消息 | 左对齐，次级背景色，主文字色 |
| 系统消息 | 居中，小字号，次级文字色 |

### 流式输出

- 使用打字机效果逐字显示
- 显示闪烁光标指示输出进行中
- 提供"停止生成"按钮

### Trace 信息

- 默认折叠，点击展开
- 使用等宽字体显示 Trace ID
- 提供一键复制功能

---

## 设计资源引用

> ⚠️ 以下为占位符，需在实际设计工作中替换为真实链接。

| 资源 | 链接 | 说明 |
|------|------|------|
| Figma 组件库 | [待补充] | 设计系统组件 |
| Figma 原型 | [待补充] | 各切片 UI 原型 |
| 图标库 | [待补充] | 推荐 Lucide Icons |
| 插图库 | [待补充] | 空状态/错误状态插图 |

---

## Out of Scope（Phase 1 不覆盖）

- ❌ 复杂动效（Lottie 动画）
- ❌ 多主题支持（仅 Light/Dark 两种）
- ❌ 国际化 RTL 布局
- ❌ 打印样式

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v0.1 | 2026-01-27 | 初稿，定义基础设计令牌和核心组件规范 | AI Agent |

---

*文档结束*
