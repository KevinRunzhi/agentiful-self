# T046 Regression Evidence (S1-2 app/context endpoints)

## Objective
Validate that S1-3 degraded-mode and quota integrations do not break S1-2 app browsing/context entry points.

## Automated Evidence

### API regression-focused test
- Command:
  - `pnpm vitest run apps/api/tests/integration/quota-degraded-mode.test.ts`
- Result:
  - Passed (`4/4`)
- Coverage:
  - `GET /api/rbac/apps/accessible` is allowed while degraded.
  - `GET /api/rbac/apps/{id}/context-options` is allowed while degraded.
  - `POST /v1/chat/completions` is denied while degraded (expected).
  - `gov.degradation.triggered` audit emission deduped per degradation episode.

## Static Route Guard Evidence
- File: `apps/api/src/middleware/quota-guard.ts`
- Safe read allowlist includes:
  - `^/api/rbac/apps/accessible$`
  - `^/api/rbac/apps/[^/]+/context-options$`
- Guarded execution path includes:
  - `^/v1/chat/completions$`

## Notes
- This regression evidence is scoped to S1-2 app/context endpoints affected by the S1-3 guard path.
- Full legacy S1-2 test suite is not runnable as-is due existing unrelated repository baseline issues.

