# Tasks: S1-3 搴旂敤鍏ュ彛涓庡伐浣滃彴

**Input**: Design documents from `/specs/003-s1-3-app-workbench-quota/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: 鏈垏鐗囪姹傚寘鍚叧閿矾寰勬祴璇曪紙API 闆嗘垚 + E2E锛夈€?
**Organization**: 鎸夌敤鎴锋晠浜嬪垎缁勶紝淇濊瘉姣忎釜鏁呬簨鍙嫭绔嬪疄鐜颁笌楠屾敹銆?
## Format: `[ID] [P?] [Story] Description`

- **[P]**: 鍙苟琛屾墽琛岋紙涓嶅悓鏂囦欢锛屾棤渚濊禆鍐茬獊锛?- **[Story]**: `US1`..`US4`

## Path Conventions

- API: `apps/api/src/`
- Web: `apps/web/src/`
- DB: `packages/db/src/`
- Shared types: `packages/shared/src/`

---

## Phase 1: Setup (Stage A Baseline)

**Purpose**: 鎵撻€?S1-3 鐨勫彲瀹炴柦鍩虹嚎

- [x] T001 Register RBAC routes in `apps/api/src/server.ts`
- [x] T002 Add apps routes registration in `apps/api/src/modules/rbac/routes/index.ts`
- [x] T003 [P] Add `/apps` entry page in `apps/web/src/app/(main)/apps/page.tsx`
- [x] T004 [P] Define S1-3 shared DTOs in `packages/shared/src/apps/` and `packages/shared/src/quota/`
- [x] T005 Run targeted API/Web type checks and capture blockers

**Checkpoint**: API routes and web entry are reachable for S1-3 integration.

---

## Phase 2: Foundational Data & Services

**Purpose**: 閰嶉涓庡伐浣滃彴鐨勬暟鎹熀纭€锛堥樆濉炲悗缁晠浜嬶級

- [x] T006 Create quota schema in `packages/db/src/schema/quota.ts`
- [x] T007 [P] Extend app schema fields in `packages/db/src/schema/rbac.ts`
- [x] T008 [P] Create app_favorite and app_recent_use schema in `packages/db/src/schema/quota.ts`
- [x] T009 Generate migration for new/updated tables
- [x] T010 Create quota repository in `apps/api/src/modules/quota/repositories/quota.repository.ts`
- [x] T011 [P] Create quota check service in `apps/api/src/modules/quota/services/quota-check.service.ts`
- [x] T012 [P] Create quota deduct service in `apps/api/src/modules/quota/services/quota-deduct.service.ts`
- [x] T013 Create quota alert service in `apps/api/src/modules/quota/services/quota-alert.service.ts`
- [x] T014 Add quota guard middleware in `apps/api/src/middleware/quota-guard.ts`

**Checkpoint**: Data model and quota service pipeline are usable.

---

## Phase 3: User Story 1 - 鎺堟潈搴旂敤宸ヤ綔鍙颁笌鍙戠幇 (Priority: P1)

**Goal**: 鐢ㄦ埛鍙湪宸ヤ綔鍙板彂鐜板苟浣跨敤鎺堟潈搴旂敤锛堟渶杩戜娇鐢?鏀惰棌/鍒嗙被/鎼滅储锛?**Independent Test**: 鍙儴缃插伐浣滃彴鑳藉姏锛屽嵆鍙獙璇?`AC-S1-3-01` `AC-S1-3-02` `AC-S1-3-03`

### Implementation for User Story 1

- [x] T015 [P] [US1] Refactor app list query in `apps/api/src/modules/rbac/services/app.service.ts` (no N+1)
- [x] T016 [P] [US1] Add workbench query params in `apps/api/src/modules/rbac/routes/apps.routes.ts`
- [x] T017 [US1] Add favorite APIs in `apps/api/src/modules/rbac/routes/apps.routes.ts`
- [x] T018 [US1] Add recent-use write path in `apps/api/src/modules/rbac/services/app.service.ts`
- [x] T019 [P] [US1] Implement `/apps` workbench UI in `apps/web/src/app/(main)/apps/page.tsx`
- [x] T020 [P] [US1] Add app search and category components in `apps/web/src/features/apps/components/`
- [x] T021 [US1] Add favorites/recent hooks in `apps/web/src/features/apps/hooks/`
- [x] T022 [US1] Add E2E for authorized visibility and tabs in `apps/web/e2e/apps/workbench.spec.ts`
- [x] T023 [US1] Add performance test for search P95 鈮?300ms in `apps/api/tests/performance/apps-search.test.ts`

**Checkpoint**: `AC-S1-3-01/02/03` testable.

---

## Phase 4: User Story 2 - 閰嶉妫€鏌ヤ笌瓒呴檺鎷︽埅 (Priority: P1)

**Goal**: 涓夌骇閰嶉闄愬埗鐢熸晥锛岃秴闄愯姹傝鎷︽埅锛屾墸鍑忓綊鍥犳纭? 
**Independent Test**: 鍗曠嫭寮€鍚?quota guard 鍗冲彲楠岃瘉 `AC-S1-3-04` `AC-S1-3-06` `AC-S1-3-07`

### Implementation for User Story 2

- [x] T024 [P] [US2] Implement Tenant/Group/User check chain in `apps/api/src/modules/quota/services/quota-check.service.ts`
- [x] T025 [P] [US2] Implement deduction and ledger write in `apps/api/src/modules/quota/services/quota-deduct.service.ts`
- [x] T026 [US2] Integrate quota guard into chat execution entry in `apps/api/src/middleware/quota-guard.ts`
- [x] T027 [US2] Add `POST /internal/quota/check` route in `apps/api/src/modules/quota/routes/quota.routes.ts`
- [x] T028 [US2] Add `POST /internal/quota/deduct` route in `apps/api/src/modules/quota/routes/quota.routes.ts`
- [x] T029 [US2] Return standardized `quota_exceeded` error payload with traceId
- [x] T030 [US2] Add unit tests for attribution with `X-Active-Group-ID`
- [x] T031 [US2] Add integration tests for 3-level quota enforcement

**Checkpoint**: `AC-S1-3-04/06/07` testable.

---

## Phase 5: User Story 3 - 闃堝€煎憡璀︿笌瀹¤ (Priority: P1)

**Goal**: 80/90/100 鍛婅瑙﹀彂骞跺彲杩借釜  
**Independent Test**: 鍥炴斁 usage 鍒伴槇鍊硷紝楠岃瘉鍛婅涓庡幓閲?
### Implementation for User Story 3

- [x] T032 [P] [US3] Implement threshold evaluation in `apps/api/src/modules/quota/services/quota-alert.service.ts`
- [x] T033 [P] [US3] Implement dedupe key strategy (Redis) in quota alert service
- [x] T034 [US3] Persist alert events in `quota_alert_event`
- [x] T035 [US3] Add in-app notification dispatch for quota alerts
- [x] T036 [US3] Add audit events `gov.quota.warning` and `gov.quota.exceeded`
- [x] T037 [US3] Add integration tests for alert latency and dedupe

**Checkpoint**: `AC-S1-3-05` testable.

---

## Phase 6: User Story 4 - 閰嶉鏈嶅姟闄嶇骇 (Priority: P1)

**Goal**: 閰嶉鏈嶅姟涓嶅彲鐢ㄦ椂淇濇寔鈥滃彲娴忚銆佺鏂板缓鈥? 
**Independent Test**: 鏁呴殰娉ㄥ叆鍚庨獙璇佸垪琛ㄤ笌鏂板璇濊涓?
### Implementation for User Story 4

- [x] T038 [P] [US4] Add quota-service health state to middleware
- [x] T039 [US4] Implement degraded deny-new-request behavior in quota guard
- [x] T040 [US4] Keep app list endpoints available during degradation
- [x] T041 [US4] Show degradation banner and disable action in `/apps` UI
- [x] T042 [US4] Emit `gov.degradation.triggered` audit event
- [x] T043 [US4] Add integration + E2E tests for `AC-S1-3-B01`

**Checkpoint**: `AC-S1-3-B01` testable.

---

## Phase 7: Polish & Cross-Cutting

- [x] T044 [P] Update docs in `docs/frd/AFUI-FRD-S1-3.md` with final API examples
- [x] T045 [P] Add observability dashboards for quota metrics
- [x] T046 Run regression against S1-2 apps/context endpoints
- [x] T047 Run full acceptance checklist and collect evidence

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 鈫?Phase 2 鈫?US1/US2/US3/US4 鈫?Phase 7
- US3 depends on US2 ledger path
- US4 depends on quota guard availability

### Parallel Opportunities

- T003, T004 can run in parallel with T001/T002
- Schema tasks T007/T008 parallel
- US1 UI tasks and API tasks can parallelize after T015/T016
- US3 and US4 can parallelize after US2 core path done

## MVP Cutline

鑻ラ渶瑕佹渶灏忓彲浜や粯锛屽缓璁垏鍦細

- 瀹屾垚 US1 + US2 + US4锛堝厛涓嶅仛澶嶆潅鍛婅鍒嗗彂锛夛紝鍗冲彲婊¤冻鍏抽敭浣撻獙涓庢不鐞嗗簳绾裤€?
