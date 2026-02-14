# T005 Typecheck Blockers (2026-02-14)

## Commands
- `pnpm --filter @agentifui/api typecheck`
- `pnpm --filter @agentifui/web typecheck`

## Result
- API: failed with large pre-existing error set (hundreds of errors across auth/rbac/core infra modules).
- Web: failed with large pre-existing error set (hundreds of errors across e2e legacy specs, ui package imports, and auth/group feature modules).

## Representative API blockers
- `apps/api/src/app.ts`: Fastify typing mismatches and unknown error handling.
- `apps/api/src/modules/auth/*`: Better Auth API drift, missing exports, exact-optional typing mismatches.
- `apps/api/src/modules/rbac/*`: incompatible audit payloads and missing schema imports.
- `apps/api/src/plugins/*`: plugin export mismatch and request typing gaps.

## Representative Web blockers
- `apps/web/e2e/rbac/*.spec.ts`: strict TS issues in legacy E2E specs.
- `apps/web/src/components/ui/*`: unresolved `@agentifui/ui` imports.
- `apps/web/src/features/auth/*`: unknown response payload typing and exact-optional mismatches.
- `apps/web/src/features/group/*`: UI typing and DOM lib typing inconsistencies.

## Impact on S1-3
- S1-3 targeted tests added in this iteration are executable and passing under Vitest.
- Full workspace typecheck remains blocked by unrelated baseline issues outside S1-3 scope.

