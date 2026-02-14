# S1-3 Quota Observability Dashboard

## Scope
- Feature slice: S1-3 (app workbench + quota governance)
- Last updated: 2026-02-14

## Dashboard Panels

### 1) Quota check throughput
- Metric: `quota_check_requests_total`
- Dimensions: `tenant_id`, `scope` (`tenant|group|user`), `result` (`allow|deny|error`)
- Panel type: stacked time series (1m rate)

### 2) Quota check latency
- Metric: `quota_check_duration_ms`
- Stats: P50, P95, P99
- SLO: P95 <= 50ms
- Panel type: percentile time series

### 3) Quota deduct throughput
- Metric: `quota_deduct_requests_total`
- Dimensions: `tenant_id`, `metering_mode` (`token|request`)
- Panel type: time series

### 4) Quota exceeded events
- Metric: `quota_exceeded_total`
- Dimensions: `scope`, `tenant_id`
- Panel type: bar chart + top tenants table

### 5) Alert threshold triggers
- Metric: `quota_alert_triggered_total`
- Dimensions: `threshold` (`80|90|100`), `scope`, `tenant_id`
- Panel type: stacked bar chart

### 6) Alert dedupe efficiency
- Metric A: `quota_alert_candidate_total`
- Metric B: `quota_alert_triggered_total`
- Derived: dedupe ratio = `1 - triggered/candidate`
- Panel type: single stat + trend line

### 7) Degraded state visibility
- Metric: `quota_guard_degraded_state`
- Value: `0` healthy, `1` degraded
- Dimensions: `source`, `reason`
- Panel type: state timeline

### 8) Degraded denials for new execution
- Metric: `quota_guard_deny_new_total`
- Endpoint filter: `/v1/chat/completions`
- Panel type: time series + trace link table

### 9) Workbench availability under degraded mode
- Metric: `http_requests_total`
- Filter: `path in (/api/rbac/apps/accessible, /api/rbac/apps/:id/context-options)`
- Dimensions: `status`
- Panel type: status ratio (2xx vs non-2xx)

## Alerting Rules

### Rule A: Quota check latency regression
- Condition: `P95(quota_check_duration_ms) > 50ms` for 5m
- Severity: warning

### Rule B: Frequent quota service degradation
- Condition: `changes(quota_guard_degraded_state[30m]) >= 3`
- Severity: critical

### Rule C: New execution denied spike
- Condition: `rate(quota_guard_deny_new_total[5m]) > 1/s` for 10m
- Severity: warning

### Rule D: Missing 100% threshold alert
- Condition: `quota_exceeded_total > 0` and `quota_alert_triggered_total{threshold=\"100\"} == 0` for 5m
- Severity: critical

## Trace and Audit Correlation
- Include `trace_id` in quota check, deduct, and denial logs.
- Audit events expected:
  - `gov.quota.warning`
  - `gov.quota.exceeded`
  - `gov.degradation.triggered`
- Dashboard tables should link `trace_id` to tracing backend query URL.

