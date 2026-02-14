# Git Worktree 并行开发指南

## 当前目录结构

```
e:\code\Project\iflab\
├── agentiful/          ← 主仓库（master 分支，不在这里写代码）
├── agentiful-s1-2/     ← S1-2 RBAC 工作目录（002-rbac-authorization-model 分支）
├── agentiful-s1-3/     ← S1-3 应用入口 工作目录（003-app-workspace 分支）
```

## 核心概念

**Worktree = 一个分支的独立工作目录**

- 普通 Git：一次只能在一个分支上工作，切换分支要 stash/commit
- Worktree：每个分支有自己的目录，可以同时打开、同时编辑、同时运行

**三个目录共享同一个 `.git`（历史、远程等），但文件系统完全独立。**

---

## 日常使用场景

### 场景 1：继续 S1-2 剩余任务

```powershell
# 1. 打开 S1-2 的目录
cd e:\code\Project\iflab\agentiful-s1-2

# 2. 启动 Claude Code
claude

# 3. 在 Claude Code 中继续实现
/speckit.implement
# 或者手动继续 T114-T145
```

你也可以直接在 IDE（如 VS Code）中打开 `agentiful-s1-2` 文件夹。

### 场景 2：同时开始 S1-3 新切片

```powershell
# 1. 打开另一个终端/IDE 窗口
cd e:\code\Project\iflab\agentiful-s1-3

# 2. 启动 Claude Code
claude

# 3. 开始 S1-3 的 SpecKit 流程
/speckit.specify <粘贴 .specify.specify/prompts/specify-s1-3.md 的内容>
/speckit.clarify <粘贴 clarify 内容>
/speckit.plan
/speckit.tasks
/speckit.implement
```

**此时你有两个 Claude Code 窗口在并行工作，互不干扰。**

### 场景 3：切片完成，提交并推送

```powershell
# 在对应的 worktree 目录中
cd e:\code\Project\iflab\agentiful-s1-2

# 提交代码
git add -A
git commit -m "feat(rbac): complete S1-2 RBAC implementation T114-T145"

# 推送到 GitHub
git push origin 002-rbac-authorization-model
```

### 场景 4：合并到 master

**方式 A（推荐）：GitHub PR**
1. 去 GitHub 仓库页面
2. 创建 Pull Request: `002-rbac-authorization-model` → `master`
3. Review 后 Merge
4. 本地同步：
```powershell
cd e:\code\Project\iflab\agentiful
git pull origin master
```

**方式 B：本地合并**
```powershell
# 回到主仓库
cd e:\code\Project\iflab\agentiful

# 合并 S1-2 到 master
git merge 002-rbac-authorization-model --no-ff -m "merge: S1-2 RBAC authorization model"

# 推送 master
git push origin master
```

### 场景 5：切片完成后删除 worktree

```powershell
# 回到主仓库
cd e:\code\Project\iflab\agentiful

# 删除 worktree（不会删除分支，只删除目录）
git worktree remove ../agentiful-s1-2

# 如果分支也不需要了（已合并到 master）
git branch -d 002-rbac-authorization-model
```

### 场景 6：创建新切片的 worktree

```powershell
# 回到主仓库
cd e:\code\Project\iflab\agentiful

# 确保 master 是最新的（包含已合并的切片）
git pull origin master

# 创建新 worktree + 新分支
git worktree add -b 004-gateway ../agentiful-s2-1 master

# 进入新目录安装依赖
cd ../agentiful-s2-1
pnpm install
```

### 场景 7：S1-3 需要 S1-2 的代码

如果 S1-3 开发到一半发现需要 S1-2 已实现的功能：

```powershell
# 在 S1-3 的 worktree 中
cd e:\code\Project\iflab\agentiful-s1-3

# 把 S1-2 的最新代码合并进来
git merge 002-rbac-authorization-model --no-edit

# 解决可能的冲突后继续开发
```

---

## 完整的切片开发生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 在主仓库创建 worktree                                        │
│     cd agentiful                                                 │
│     git worktree add -b <分支名> ../<目录名> master              │
│                                                                  │
│  2. 安装依赖                                                     │
│     cd ../<目录名>                                               │
│     pnpm install                                                 │
│                                                                  │
│  3. SpecKit 流程                                                 │
│     claude                                                       │
│     /speckit.specify → /speckit.clarify → /speckit.plan          │
│     → /speckit.tasks → /speckit.analyze → /speckit.implement     │
│                                                                  │
│  4. 提交 + 推送                                                  │
│     git add -A && git commit -m "feat: ..." && git push          │
│                                                                  │
│  5. GitHub PR → Merge to master                                  │
│                                                                  │
│  6. 清理                                                         │
│     cd agentiful                                                 │
│     git pull origin master                                       │
│     git worktree remove ../<目录名>                              │
│     git branch -d <分支名>                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 切片命名规范

| 切片 | 分支名 | Worktree 目录 |
|------|--------|--------------|
| S1-1 | `001-multi-tenant-auth` | `agentiful-s1-1/`（已合进 master） |
| S1-2 | `002-rbac-authorization-model` | `agentiful-s1-2/` ✅ 已创建 |
| S1-3 | `003-app-workspace` | `agentiful-s1-3/` ✅ 已创建 |
| S2-1 | `004-gateway` | `agentiful-s2-1/` |
| S2-2 | `005-chat-streaming` | `agentiful-s2-2/` |
| S2-3 | `006-execution-data` | `agentiful-s2-3/` |
| S3-1 | `007-admin-panel` | `agentiful-s3-1/` |
| S3-2 | `008-audit-compliance` | `agentiful-s3-2/` |
| S3-3 | `009-platform-mgmt` | `agentiful-s3-3/` |

---

## 注意事项

### ⚠️ 不能做的事
- ❌ 不要在主仓库 `agentiful/` 里写业务代码（保持干净的 master）
- ❌ 不要在两个 worktree 中 checkout 同一个分支
- ❌ 不要直接删除 worktree 目录（用 `git worktree remove`）

### ✅ 最佳实践
- ✅ 每次创建新 worktree 前先 `git pull origin master` 拿最新代码
- ✅ 每个 worktree 单独 `pnpm install`
- ✅ 开发前先确认当前目录在哪个 worktree（`git branch --show-current`）
- ✅ 需要跨切片依赖时用 `git merge <源分支>` 拉取

### 🔧 常用命令速查

```powershell
# 查看所有 worktree
git worktree list

# 查看当前在哪个分支
git branch --show-current

# 创建新 worktree
git worktree add -b <分支名> <目录路径> master

# 删除 worktree
git worktree remove <目录路径>

# 清理已删除目录的 worktree 记录
git worktree prune
```

---

## 并行开发示意图

```
终端 A (agentiful-s1-2/)          终端 B (agentiful-s1-3/)
─────────────────────────         ─────────────────────────
claude                            claude
/speckit.implement                /speckit.specify <S1-3>
  → T114: Smart context switch      → 生成 spec.md
  → T115-T120: Frontend             → /speckit.clarify
  → T121-T136: Polish               → /speckit.plan
  ...                                → /speckit.tasks
                                     → /speckit.implement
git add && git commit               git add && git commit
git push                            git push
                                  
      ↓ 完成后各自发 PR ↓
      
      GitHub: PR → merge to master
```
