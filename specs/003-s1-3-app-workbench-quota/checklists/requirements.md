# Requirements Checklist: S1-3

**Purpose**: 验证 S1-3 规范是否完整覆盖验收与实现边界。  
**Date**: 2026-02-13

## Coverage

- [x] 明确映射 S1-3 Feature ID（F-APP-001/F-APP-004/F-QUOTA-001..004）
- [x] 明确映射验收条目 AC-S1-3-01..07
- [x] 包含边界验收 AC-S1-3-B01（降级策略）
- [x] 定义 In Scope / Out of Scope，避免与 S3-1 交叉

## Functional

- [x] 包含应用工作台能力（recent/favorites/all/search/category）
- [x] 包含三级配额限制（Tenant/Group/User）
- [x] 包含配额扣减归因（当前工作群组）
- [x] 包含阈值告警（80/90/100）与去重要求
- [x] 包含配额服务不可用降级行为

## Non-Functional

- [x] 搜索 P95 ≤ 300ms
- [x] 配额检查 P95 ≤ 50ms
- [x] 告警延迟 ≤ 5min
- [x] 关键路径 Trace ID 贯穿

## Data & Contract

- [x] 定义 App 扩展字段
- [x] 定义 QuotaPolicy/Counter/Ledger/Alert 实体
- [x] 定义工作台 API 契约
- [x] 定义 quota check/deduct 契约

## Testing

- [x] 每个用户故事都给出独立测试路径
- [x] 任务拆分包含单元/集成/E2E
- [x] 包含降级演练测试
