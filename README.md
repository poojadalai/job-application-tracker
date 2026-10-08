# Job Application Tracker

A private Kanban board for your job search: every application, its status and your next step in one place, behind GitHub sign-in.

[![CI](https://github.com/poojadalai/job-application-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/poojadalai/job-application-tracker/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

**[Live demo →](https://job-application-tracker-sigma-nine.vercel.app)**
Sign in with your GitHub account. Your board starts empty and is visible only to you.

## Screenshots

<!-- Drop files into docs/ and uncomment. -->
<!--
![Kanban board with drag-and-drop](docs/board.gif)

| Board view | List view |
|---|---|
| ![Board view](docs/board.png) | ![List view](docs/list.png) |
-->

## Features

- **Kanban board.** Drag applications between Applied → Screening → Interview → Offer → Rejected. Columns can be reordered for the current session, and long columns show as many cards as fit on screen, with a "Show more" button right below.
- **Keyboard-accessible drag-and-drop.** Arrow keys move a card a whole column at a time, and screen readers announce each move.
- **Optimistic updates.** A status change shows instantly and settles once the server confirms it. If the save fails, you see an error.
- **List view** as a sortable, paginated table: sort by company, role, status (pipeline order) or date applied; 10/20/50 rows per page; inline status changes.
- **Add, edit and delete** applications in an accessible dialog (native `<dialog>`: focus stays inside, Esc closes), so the board is always the first thing on the page. Fields: company, role, date applied, next step, job posting link, job description and notes.
- **Fill from link.** Paste a job posting URL and the company, role and job description are filled in from the page's schema.org `JobPosting` data (with Open Graph as a fallback). Only empty fields are filled. Login-walled sites such as LinkedIn fall back to manual entry.
- **Search** by company or role, and **filter** by status using clickable count tiles.
- **Stats page.** Applications this week, response rate, and a bar chart of applications by current stage, with empty states. Counted in Postgres for the signed-in user only.
- **GitHub sign-in.** Each user sees and changes only their own applications.
- **Dark mode**, following the system setting.
- **Tested:** unit and component tests (Vitest + React Testing Library), integration tests that prove per-user data isolation against a real Postgres database, and Playwright end-to-end tests. All of them run in CI on every pull request and push to main.

**Planned:** an AI job-fit analyzer (see [Roadmap](#roadmap)).

## Tech stack

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) | Server rendering and data mutations live in one typed codebase, with no separate API to maintain. |
| Language | TypeScript | Types run end to end, from the Prisma models to the React props. |
| Styling | Tailwind CSS 4 | Fast, consistent styling with built-in dark mode and no CSS files to keep in sync. |
| Database | PostgreSQL (Neon) via Prisma 7 | Relational data with type-safe queries and versioned migrations. |
| Auth | Auth.js (NextAuth v5) with GitHub OAuth | The audience is developers, so GitHub sign-in is low-friction and means no passwords to store. |
| Client state | Zustand | A small store for UI-only state (current view, column order, drag state), kept separate from server data. |
| Tables | TanStack Table v9 | Headless sorting and pagination logic, while the markup and Tailwind styling stay my own. |
| Drag and drop | dnd-kit | Supports keyboard and screen readers out of the box, which most drag-and-drop libraries don't. |
| Testing | Vitest, React Testing Library, Playwright | Fast unit and component tests, plus real-browser tests of the core flows. |
| Hosting / CI | Vercel and GitHub Actions | Preview deploys for every PR, plus a lint, type-check, build and test gate with a throwaway Postgres. |

## Architecture & decisions

**Server Actions instead of a REST layer.** The page is a Server Component that reads the signed-in user's applications directly from the database. Mutations (`create`, `update`, `updateStatus`, `delete`) are Server Actions in [`src/app/actions.ts`](src/app/actions.ts) that the client calls like typed functions, then `refresh()` the page. That removes a layer of route handlers, fetch wrappers and duplicated request types. The trade-off is that Server Actions are still public POST endpoints, so every input is validated again on the server (required fields, status enum, date format, length limits) and nothing from the client is trusted.

**Data model.** There are two tables. A `User` is created or updated from the GitHub profile on sign-in. An `Application` has a `status` enum, an optional applied date, a free-text next step, a link, the job description and notes. Each application belongs to one user (`userId`, indexed), and deleting a user also deletes their applications. Interview stages are currently modelled as statuses; a dedicated `Interview` model is on the roadmap.

**How per-user data is protected.** Every query and mutation first calls `requireUserId()`, which reads the session and throws if there isn't one. Writes use `updateMany` / `deleteMany` filtered by both `id` and `userId`. If someone sends another user's application ID, the query simply matches nothing and fails like a missing record. That rules out insecure direct object references without an extra read just to check ownership.

**Stats are aggregated on the server.** The `/stats` page is a Server Component that runs a Prisma `groupBy` on status and a `count` for this week, both filtered by `userId`, so only totals reach the browser and no chart library is needed (the bars are plain HTML/CSS with the numbers as text). Definitions: *this week* is Monday to Sunday on UTC dates, by applied date; a *response* is any application that has moved past Applied, rejections included. There is no status history yet, so the chart shows each application's **current** stage rather than a true conversion funnel; that would need a status-change table.

**Problems solved and trade-offs**

- **Fetching user-supplied URLs safely (SSRF).** "Fill from link" makes the server request a URL a user typed, which could otherwise be pointed at internal addresses such as cloud metadata (`169.254.169.254`). [`safe-fetch.ts`](src/lib/safe-fetch.ts) allows only http(s) on standard ports and checks every resolved IP inside the DNS lookup used for the actual connection, so a hostname can't pass the check and then resolve somewhere private (DNS rebinding). Redirects go through the same checks, with a 5-second deadline and a 2 MB cap. No dependency was needed.

- **Adding auth to an app that already had data.** Applications created before sign-in existed had no owner. `userId` is nullable, and on first sign-in the GitHub account named in `CLAIM_UNOWNED_GITHUB_LOGIN` takes ownership of those rows. Existing data was migrated without a manual script.
- **Changing an enum without losing data.** Replacing the `Wishlist` status with `Screening` needed a hand-edited migration: move the affected rows to `Applied` first, then swap the Postgres enum inside a transaction.
- **JWT sessions over database sessions.** This keeps the schema to two tables and avoids a DB lookup on every request. The trade-off is that a session can't be revoked server-side before it expires.

## Run locally

**Prerequisites:** Node 24 (see `.nvmrc`), a PostgreSQL database (a free [Neon](https://neon.tech) project works), and a [GitHub OAuth app](https://github.com/settings/developers) with the callback URL `http://localhost:3000/api/auth/callback/github`.

```bash
git clone https://github.com/poojadalai/job-application-tracker.git
cd job-application-tracker

# 1. Configure env vars first; `npm ci` runs `prisma generate`, which needs DATABASE_URL
cp .env.example .env        # then fill in the values

# 2. Install, create the tables, start the dev server
npm ci
npx prisma migrate dev
npm run dev                 # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session encryption key; generate one with `npx auth secret` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials |
| `CLAIM_UNOWNED_GITHUB_LOGIN` | Optional. GitHub login that takes ownership of applications created before auth existed |

## Testing

| Command | What it runs | Needs a database? |
|---|---|---|
| `npm test` | Unit and component tests: validation, session guard, board store, the Tracker UI | No |
| `npm run test:integration` | The real Server Actions against Postgres, proving users can't read, edit, move or delete each other's applications | Yes |
| `npm run test:e2e` | Playwright (Chromium): add, move by keyboard, edit, delete, and a two-user isolation check | Yes |

**Test database.** Integration and e2e tests never use `DATABASE_URL`. They read `TEST_DATABASE_URL` from `.env.test.local` and refuse to run if it points at the same database as `.env`. Each test creates its own users and deletes them afterwards. In CI, a Postgres service container is used instead.

```bash
npm run test:db:migrate            # once, and again after new migrations
npx playwright install chromium    # once
```

**Sign-in in e2e tests.** Tests don't go through GitHub. A fixture creates a test user in the test database and sets the same encrypted session cookie Auth.js would set after OAuth, signed with a test-only `AUTH_SECRET` that the app under test is started with. The app has no test-only login route.

CI runs: lint → `next typegen` + `tsc` → unit tests → build → integration tests → e2e tests.

## Roadmap

- [ ] AI job-fit analyzer: compare a saved job description against your profile and highlight gaps
- [x] Stats view: this-week count, response rate, applications by current stage
- [ ] Status history: a true conversion funnel and time spent in each stage
- [ ] `Interview` model: multiple rounds per application, with dates and outcomes
- [ ] Persist board preferences (column order, view) per user
