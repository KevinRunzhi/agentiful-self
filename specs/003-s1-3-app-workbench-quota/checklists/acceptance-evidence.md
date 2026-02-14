# T047 Acceptance Evidence (S1-3)

## Executed Command Evidence

### S1-3 test pack
- Command:
  - `pnpm vitest run apps/api/tests/unit/quota-attribution.test.ts apps/api/tests/integration/quota-enforcement.test.ts apps/api/tests/integration/quota-alerts.test.ts apps/api/tests/integration/quota-degraded-mode.test.ts apps/api/tests/performance/apps-search.test.ts`
- Result:
  - Passed (`5 files, 13 tests`)

### Degraded-mode regression rerun
- Command:
  - `pnpm vitest run apps/api/tests/integration/quota-degraded-mode.test.ts`
- Result:
  - Passed (`1 file, 4 tests`)

### E2E run status
- Command:
  - `pnpm playwright test apps/web/e2e/apps/workbench.spec.ts --project=chromium --reporter=line`
- Result:
  - Blocked by local web server startup timeout (60s) in current environment.

### E2E spec discovery
- Command:
  - `pnpm playwright test apps/web/e2e/apps/workbench.spec.ts --list`
- Result:
  - Passed test discovery (`6 cases` across chromium/firefox/webkit projects).

## AC Mapping

### AC-S1-3-01 Authorized app visibility
- Evidence:
  - `apps/web/e2e/apps/workbench.spec.ts` (`shows authorized apps and view tabs`)
  - API list visibility logic in `apps/api/src/modules/rbac/services/app.service.ts`

### AC-S1-3-02 Recent/Favorites/All behavior
- Evidence:
  - `apps/web/e2e/apps/workbench.spec.ts` tab switching assertions
  - Workbench APIs in `apps/api/src/modules/rbac/routes/apps.routes.ts`

### AC-S1-3-03 Search performance P95 <= 300ms
- Evidence:
  - `apps/api/tests/performance/apps-search.test.ts`

### AC-S1-3-04 Quota pre-check deny on exceed
- Evidence:
  - `apps/api/tests/integration/quota-enforcement.test.ts` (group/user exceed scenarios)
  - `apps/api/src/modules/quota/routes/quota.routes.ts` standardized `quota_exceeded` response

### AC-S1-3-05 Threshold alerts and dedupe
- Evidence:
  - `apps/api/tests/integration/quota-alerts.test.ts`
  - Alert service + dedupe store:
    - `apps/api/src/modules/quota/services/quota-alert.service.ts`
    - `apps/api/src/modules/quota/services/quota-alert-dedupe.store.ts`

### AC-S1-3-06 Attribution to active/default group
- Evidence:
  - `apps/api/tests/unit/quota-attribution.test.ts`
  - Attribution service:
    - `apps/api/src/modules/quota/services/quota-attribution.service.ts`

### AC-S1-3-07 Tenant/Group/User 3-level enforcement
- Evidence:
  - `apps/api/tests/integration/quota-enforcement.test.ts`
  - Check service:
    - `apps/api/src/modules/quota/services/quota-check.service.ts`

### AC-S1-3-B01 Degraded mode: browse allowed, new execution denied
- Evidence:
  - `apps/api/tests/integration/quota-degraded-mode.test.ts`
  - `apps/web/e2e/apps/workbench.spec.ts` degraded banner + action disable test
  - Guard middleware:
    - `apps/api/src/middleware/quota-guard.ts`

## Residual Gaps
- Playwright E2E execution is currently blocked by environment startup timeout and needs rerun in a stable web runtime.
