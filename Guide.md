<!-- Guide.md — reorganized overview and learning path -->

# Getting Started Guide — Gradual Ownership Path

This guide helps you take incremental ownership of the codebase. Work top-to-bottom: start with the Orientation steps to learn the shape of the system, then move to Small Safe Changes, and finally explore Architecture and end-to-end work.

---

## Quick navigation

- **Orientation (read & understand, no risk)** — short, high-value reads and tests to build a mental model.
- **Small Safe Changes** — low-risk code additions that teach conventions and CI.
- **Architecture Deep-Dive** — harder tasks touching proxies, integration tests, and end-to-end features.

---

## Orientation (read / run, no risk)

1. Read the Prisma schema end-to-end

	- File: `prisma/schema.prisma`
	- Why: most domain models and relationships live here. Trace `Tournament → TournamentTeam → TournamentPlayer` to map features to tables.

2. Run the test suite and inspect a focused test

	- Command:
```bash
npm test
```
	- Open a service test (example): `src/backend/__tests__/services/tournamentService.test.ts`.
	- Action: pick one `it(...)` block, find the service method under test, and step through its implementation.

3. Trace a full HTTP request

	- Example: `GET /api/groups`
	- Follow the path: `src/backend/routes/groupRoutes.ts` → controller → `src/backend/services/groupService.ts` → Prisma client call.
	- Outcome: you will learn the routing pattern, controller/service separation, and error/response shape.

---

## Small Safe Changes (low risk, high learning)

1. Add a missing validation

	- Why: controller input coercion is noted as fragile and untested.
	- Task: pick an endpoint that accepts a numeric param (e.g. `maxTeams` or `maxPlayersPerTeam`) and add a `zod` schema (or manual guard) that enforces a positive integer.
	- Test: add a unit test for the controller that verifies invalid input returns 400.

2. Write your first controller test

	- Why: controller handlers are under-tested.
	- Task: create a Vitest test for `GET /api/tournaments/:id` that mocks the service with `vi.mock`.
	- How: model the test on service tests in `src/backend/__tests__/services/` and assert status codes and response shape.

3. Add a small Prisma migration

	- Low-risk change: add a nullable `notes` text column to `TournamentMatch`.
	- Commands:
```bash
npx prisma migrate dev --name add_match_notes
npm run prisma:generate
```
	- Update the service to pass the field through and write a unit test.

---

## Architecture Deep-Dive (higher complexity)

1. Understand the microservices proxy layer

	- Files to read: `src/backend/controllers/proxies/*` and the corresponding service modules (e.g. `community-service/`).
	- Why: this code contains routing, fail-closed/fail-open patterns, and proxy telemetry used during the service migration.

2. Add a supertest-style integration test

	- Gap: there is no integration suite.
	- Task: write an integration test for an unauthenticated endpoint (e.g. `GET /api/tournaments/portal/:shareToken`).
	- Note: this may require a test DB or heavy mocking; start by mocking Prisma at the module level if preferred.

3. Implement a small end-to-end feature

	- Candidate: build a Flutter screen for `GET /api/tournaments/:id/analytics`.
	- Why: touches mobile UI, API integration, Riverpod providers, and gives a visible result.

---

## Recommended starting sequence

1. Orientation items 1–3 (read schema, run tests, trace request)
2. Small Safe Change #2 (write your first controller test)
3. Small Safe Change #1 (add a validation)

These steps will give you confidence and context before touching migrations or cross-service code.

---

## Quick references

- Project overview: `PROJECT_OVERVIEW.md`
- Backend code: `src/backend/`
- Mobile app: `src/mobile/`
- Prisma schema: `prisma/schema.prisma`
- Tests: `src/backend/__tests__/`

---

If you'd like, I can:
- add example test scaffolding for `GET /api/tournaments/:id`;
- create a sample `zod` validator and controller unit test;
- or commit this reorganized `Guide.md` for you.

Tell me which next step you want me to do.