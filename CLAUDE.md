@AGENTS.md
CLAUDE.md: Job Application Tracker

Read this file at the start of every session. It is the source of truth for context, decisions, and working rules. If something here conflicts with what you see in the code, tell me before acting.

1. What this project is and why it exists

A personal, authenticated job-application tracker with an AI job-fit analyzer. I (Pooja) am a frontend/full-stack developer using it as a portfolio project for my active job search. That has three consequences:

Interview-defensible code. Everything must be something I can explain in an interview: why this approach, what the trade-offs were. Prefer clear, idiomatic code over clever code. When you make a non-obvious choice, add a one-line explanation in your reply (not a wall of comments in code).
New skills on purpose. The stack was chosen to show skills that are not yet on my CV (see section 3). Do not swap these for familiar alternatives without asking.
Recruiter-facing. The README, repo hygiene, CI badge, and live demo all matter as much as features.

Repo: poojadalai/job-application-tracker (GitHub). Live site: deployed on Vercel. Primary dev machine: Windows (PowerShell). Give Windows-friendly commands.

2. Features (target scope)
Auth-gated, per-user data (GitHub OAuth only for now)
Kanban board: Applied, Screening, Interview, Offer/Rejected, with drag-and-drop
Add/edit/update applications via Server Actions (no separate REST layer for basic CRUD)
Data model: User, Application (company, role, status, appliedDate, jobDescription, notes), Interview (date, stage, outcome)
AI job-fit analyzer: paste a job description, get a streamed fit score, matched skills, missing keywords, and suggested resume-bullet phrasing
Stats view: applications this week, response rate, funnel by stage
Responsive, Tailwind-styled UI
3. Tech stack and why (do not change without asking)
Area	Choice	Why	In repo?
Framework	Next.js 16 (16.3.8), App Router, Server Components + Server Actions	Most-asked Next.js interview topic; full-stack without a separate backend	Yes
Language	TypeScript (strict)		Yes (strict: true)
Styling	Tailwind CSS 4	Common requirement, new to my CV	Yes
Client state	Zustand (only where genuinely needed)	Modern alternative to Redux, which I already know	Yes, UI-only state (view, column order, drag state) in src/lib/board-store.ts; not persisted
Server state	TanStack Query (only where genuinely needed)	Right tool for client-side server state	Not installed. Server data comes from Server Components as props; optimistic status changes use React's useOptimistic
Drag and drop	dnd-kit (@dnd-kit/core)	Keyboard and screen-reader support built in	Yes
Data	Prisma 7 + Postgres (Neon)	TS-first ORM	Yes, via @prisma/adapter-pg; models User + Application (no Interview yet)
Auth	Auth.js v5 (next-auth beta), GitHub provider, JWT sessions	Not on my CV yet	Yes
Validation	Hand-written checks in src/app/actions.ts		Zod is not installed (section 6 mentions it as an example)
AI	Vercel AI SDK	Modern streamed-LLM pattern	Not installed (planned, #7)
Unit/component tests	Vitest + React Testing Library		Yes (tests/unit, tests/integration; vitest.config.mts)
E2E tests	Playwright (Chromium)		Yes (e2e/, playwright.config.ts)
CI/CD	GitHub Actions + Vercel		Yes

Before adding Zustand or TanStack Query to any feature, check whether Server Components/Server Actions already solve it. Only use them where there is a real client-side need, and tell me why. (Optimistic drag-and-drop is already handled by useOptimistic, not by either library.)

4. Current status

(Verify against the repo and GitHub Project board; update this section as work lands.)

Last verified: 2026-10-05.

Done (issues closed): Prisma schema + Postgres (#2), Next.js scaffold + GitHub + Vercel deploy (#3), Application CRUD via Server Actions (#4), Kanban board with drag-and-drop (#5), GitHub OAuth auth (#6)
#1 done: GitHub Actions CI (PR #10) and README/case study + .env.example (PR #11). Vercel Production and Preview deployments both build.
In progress: #9 Vitest + Playwright tests wired into CI (branch test/vitest-playwright). After merge: make the CI check required on main.
Not built yet: Interview model, AI analyzer, stats view. No LICENSE file.
Backlog, in suggested order:
#7 AI job-fit analyzer (Vercel AI SDK, streamed)
#8 Stats view
Optional extras: Google as a second OAuth provider (needs Google Cloud credentials), branch protection on main once tests exist, a LICENSE file (MIT?), screenshots/GIF for the README, persisting board preferences (column order, view) per user
Done extras: a separate Neon branch for preview deployments (Preview DATABASE_URL points to the Neon "preview" branch, not production)
5. Project facts and gotchas (hard-won; do not relearn)
Node 24 (.nvmrc). CI reads the version from it. Vercel's Node version should also be 24.x.
Prisma 7: the client is generated into src/generated/prisma, which is gitignored. postinstall runs prisma generate, and prisma.config.ts throws if DATABASE_URL is not set. So DATABASE_URL must exist at install time, in CI and on Vercel (including Preview).
Next 16 route types: LayoutProps / PageProps are generated into .next/types. On a fresh checkout tsc fails until next typegen runs. CI already has a "generate Next.js route types" step before type-check. Keep it.
lib/db.ts only checks that DATABASE_URL exists; it does not connect at import time. A dummy URL is enough for next build in CI.
Rendering: pages that call auth() render per request.
Vercel env vars: Production and Preview are separate entries. DATABASE_URL, AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET exist for both. Secrets are write-only in Vercel. Never edit a Production variable to "add Preview"; create a separate Preview-only entry.
Vercel Deployment Protection ("Vercel Authentication") must stay OFF so the public site is reachable without a Vercel login.
GitHub sign-in only works on the production URL. The OAuth app has the production callback URL only, so sign-in on preview deployments is expected to fail. Previews only need to build.
CLAIM_UNOWNED_GITHUB_LOGIN is read only at sign-in time (not needed for builds or CI).
CI (.github/workflows/ci.yml): runs on push to main and on PRs: checkout, setup-node (from .nvmrc, npm cache), npm ci, prisma generate, lint, next typegen, tsc --noEmit, next build, with placeholder env vars (no real secrets), a concurrency group that cancels outdated runs, read-only permissions, then unit tests, integration tests and Playwright e2e against a postgres:17 service container (TEST_DATABASE_URL). Tests never use the live Neon database.
Tests: integration and e2e tests read TEST_DATABASE_URL (locally from .env.test.local, pointing at a Neon "test" branch since there is no Docker on the dev machine). tests/test-db.mjs refuses a URL on the same Neon endpoint as .env DATABASE_URL, and CI only allows localhost. Each test creates and deletes its own users. Run `npm run test:db:migrate` after new migrations.
E2E sign-in: e2e/fixtures.ts mints an Auth.js session cookie (authjs.session-token, encode() from next-auth/jwt) with a test-only AUTH_SECRET that playwright.config.ts passes to the app. There is no test login route in the app; keep it that way.
Server Action validation lives in src/lib/validation.ts (a "use server" file may only export async functions, so helpers cannot be exported from actions.ts).
6. Working rules

Workflow

One branch per issue (feat/…, ci/…, docs/…), one PR per issue. Never commit straight to main.
Before coding: read the relevant code, then say in a few lines what you found and what you plan to do. For anything bigger than a small change, wait for my OK.
Before opening a PR, run locally: npm run lint, npx tsc --noEmit, and npm run build (use dummy env vars; do not build against the live database).
Commit messages: short, imperative, and reference the issue (refs #N). Use closes #N only when the PR fully finishes the issue.
After pushing, tell me the exact commands or GitHub clicks for the next step. I am newer to the GitHub/Vercel UI.

Safety

Never commit secrets or .env. Keep .env.example with names only.
Never run destructive git commands (push --force, reset --hard, history rewrites) or touch the live database without asking first.
Do not change Vercel/GitHub settings by instruction; tell me what to click.
Do not add "Co-Authored-By: Claude" or any AI attribution trailer to commits or PR descriptions.

Code quality

Prefer Server Components and Server Actions; mark "use client" only where needed.
Validate all Server Action input (e.g. with Zod) and check the signed-in user owns the record before any read or write. Per-user data isolation is a core requirement.
Keep UI accessible (labels, keyboard support for the Kanban board where feasible) and responsive.
Don't add dependencies without saying why.

How to talk to me

Plain, short explanations. Tell me what you did, what to check, and what's next.
If something fails, show me the actual error and your diagnosis before changing things.
Flag it when a request would hurt the portfolio goal (over-engineering, unfinished features presented as done).
7. Definition of done for each backlog item
#1 README: accurate to the code (no invented features), CI badge, live demo link, screenshots/GIF placeholders, features (mark Planned items honestly), stack table with "why", architecture/decisions case study, correct run-locally steps + .env.example, roadmap.
#9 Tests: Vitest for logic/validation/components, Playwright for core flows (sign-in mocked or test-seeded, add application, move across Kanban columns). Wired into CI against a Postgres service container. Make the test check required on main.
#7 AI analyzer: streamed response via Vercel AI SDK; structured output (score, matched skills, missing keywords, suggested bullets); input length limits and rate limiting; API key only in env vars; graceful error and loading states.
#8 Stats: server-side aggregation (Prisma), this-week count, response rate, funnel by stage; empty states.
8. When you start a session
Read this file, README.md, package.json, and the Prisma schema.
Check git status and the current branch.
Ask me which issue we are on if it is not obvious, then follow the workflow in section 6.