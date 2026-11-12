<!-- Test T3 -->

# MarkerIt

MarkerIt is a pnpm and Nx monorepo. It contains the public landing page, the web app, a Spring Boot API, and shared frontend packages.

## Requirements

- Node.js 20.9 or newer
- pnpm 10.33 or newer (the repository pins this version through `packageManager`)
- JDK 21 or newer for the API
- Gradle 8.14 or newer (or Gradle 9) for the API; no Gradle wrapper is checked in yet
- Docker Engine and the Docker Compose plugin for the containerized development environment

## Getting started

Install the JavaScript workspace dependencies from the repository root:

```sh
pnpm install
```

Start one application at a time:

```sh
pnpm dev:landing # http://localhost:3001
pnpm dev:app     # http://localhost:3000
pnpm dev:api     # Spring Boot API, normally http://localhost:8080
```

To start all three applications together in one terminal, use Nx `run-many`:

```sh
pnpm nx run-many -t dev serve -p landing app api
```

Nx starts the two Next.js development servers (`landing:dev` and `app:dev`) and the API target (`api:serve`) in parallel. The development targets are marked as continuous, so they keep running until you stop the command with `Ctrl+C`. The API target invokes `gradle bootRun` from `apps/api`.

## Containerized development

The root `compose.yaml` starts the complete development stack: the Next.js app, the public landing page, the Spring Boot API, and PostgreSQL. The Node services mount the repository into the containers, so Next.js hot reload picks up source edits. The API container watches Java source files and restarts Gradle BootRun when they change. PostgreSQL data is kept in a named Docker volume.

Start the stack from the repository root:

```sh
docker compose up --build
```

Open the services at:

| Service | URL |
| --- | --- |
| Web app | http://localhost:3000 |
| Landing page | http://localhost:3001 |
| API health | http://localhost:8080/api/health |
| MinIO S3 API | http://localhost:9000 |
| MinIO console | http://localhost:9001 (user/password: `minioadmin` by default) |
| PostgreSQL | `localhost:5432` (database/user: `markerit`, password: `markerit_dev`) |

The API waits until PostgreSQL passes its health check before starting. The database credentials are development defaults only; override `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` in a root `.env` file if needed. The API provides health, authentication, workspace, project, asset, review, pin, comment and approval endpoints. Users, sessions, workspaces and projects are stored in PostgreSQL; the schema also contains tables for reviews, pins, comments, sharing, notifications and audit events.

Review images and comment attachments are stored in an S3-compatible bucket, not in PostgreSQL. The compose stack starts MinIO on port 9000, its console on port 9001, and a one-off `minio-init` service that creates the `markerit` bucket (override with `S3_BUCKET`) when it is missing. Buckets stay private: files are read through the authenticated `GET /api/v1/assets/{id}/content` endpoint, so MinIO anonymous download is not enabled. The development credentials are `minioadmin` / `minioadmin`; override `S3_ACCESS_KEY` and `S3_SECRET_KEY` if needed. For a local API process outside compose, the storage defaults point at `http://localhost:9000` and the `markerit` bucket. To use Cloudflare R2 instead, set `STORAGE_PROVIDER=R2`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION=auto` and `S3_PATH_STYLE=false`. `S3_PUBLIC_BASE_URL` is reserved for a future public/CDN asset URL and is not used by the current API. Provider names are case-insensitive. Set `STORAGE_PROVIDER=LOCAL` to store uploads on disk under `LOCAL_STORAGE_DIR` without MinIO.

### Local MinIO only

To run just the storage dependency while the API runs on the host:

```sh
docker compose up -d minio minio-init

# The API defaults already match this setup:
STORAGE_PROVIDER=S3 \
S3_ENDPOINT=http://localhost:9000 \
S3_ACCESS_KEY=minioadmin \
S3_SECRET_KEY=minioadmin \
S3_BUCKET=markerit \
S3_REGION=us-east-1 \
S3_PATH_STYLE=true \
pnpm dev:api
```

The MinIO console is available at http://localhost:9001 with `minioadmin` / `minioadmin`. Bucket contents stay private; the API streams them through the authenticated asset endpoint. Use `docker compose down -v` to delete the local MinIO volume as well as PostgreSQL data.

### Project review workflow

The project-review feature adds:

- A project page with a library of up to 8 review images and a list of review threads.
- Versioned review threads: each version points at one review image, and new versions start a fresh decision round.
- Reviewer assignment (up to 20 workspace members with a write role) and approvals scoped to the latest version.
- Pins on the image, threaded comments, image attachments on comments, resolution state, and live updates.
- Close rules that require every assigned reviewer to approve the latest version, and delete rules that clean up unused images and attachments from PostgreSQL and object storage.

Application routes:

| Route | Purpose |
| --- | --- |
| `/projects/[projectId]` | Project photo library and review-thread list |
| `/projects/[projectId]/reviews/[reviewId]` | Version canvas, pins, discussion and approvals |
| `/feedback` | Workspace feedback inbox: open and resolved pins from every project |

The workspace feedback inbox reads `GET /api/v1/workspaces/{workspaceId}/feedback`, which returns visible pins from the latest version of every review in the workspace (including closed reviews) with project, thread, version and last-comment context. The page filters by status, project and free-text search, and can resolve or reopen a note inline when its review is still open.

The review page subscribes to updates over a native STOMP WebSocket (no SockJS) at `/ws` and consumes `/topic/reviews/{reviewId}`. The API also publishes review, version and approval events on `/topic/projects/{projectId}`, but the current project page does not subscribe to that topic yet. The handshake reuses the `markerit_session` cookie. Event types are `PIN_CREATED`, `PIN_UPDATED`, `PIN_DELETED`, `COMMENT_CREATED`, `COMMENT_UPDATED`, `COMMENT_DELETED`, `REVIEW_CREATED`, `REVIEW_UPDATED`, `REVIEW_DELETED`, `VERSION_CREATED` and `APPROVAL_CREATED`.

Product limits: 3 workspaces per user, 3 projects per workspace, 8 review images per project, up to 20 reviewers per thread, 10 attachments per comment, and unlimited reviews, versions, pins and comments. Images and attachments are PNG or JPEG, at most 10 MB and 80 megapixels (12000 px per side). See [`docs/project-review.md`](docs/project-review.md) for the domain model, permissions and API list.

### Storage configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `S3` | `S3`, `R2` or `LOCAL` (case-insensitive) |
| `S3_ENDPOINT` | `http://localhost:9000` (API outside compose) | S3-compatible endpoint; compose uses `http://minio:9000` |
| `S3_ACCESS_KEY` | `minioadmin` | Access key; R2 fallback reads `R2_ACCESS_KEY_ID` |
| `S3_SECRET_KEY` | `minioadmin` | Secret key; R2 fallback reads `R2_SECRET_ACCESS_KEY` |
| `S3_BUCKET` | `markerit` | Bucket name; R2 fallback reads `R2_BUCKET` |
| `S3_REGION` | `us-east-1` | Signing region (`auto` for R2) |
| `S3_PATH_STYLE` | `true` | Path-style addressing (required by MinIO) |
| `S3_PUBLIC_BASE_URL` | `http://localhost:9000/markerit` | Reserved for future public/CDN URLs; currently unused |
| `LOCAL_STORAGE_DIR` | `${java.io.tmpdir}/markerit-storage` | Directory for `STORAGE_PROVIDER=LOCAL` |

Only the configured backend is instantiated. Each asset records the provider it was written with, but changing `STORAGE_PROVIDER` makes assets written by the previous provider unreadable because that backend is no longer available; there is no automatic migration. Keep the same provider or copy/migrate the objects before switching. Project and workspace deletion do not remove stored objects; only deleting a review thread cleans up the images and attachments that are no longer referenced.

Asset metadata responses include `originalName` and a `url` relative to the API base (`assets/{id}/content`). Clients that already prefix requests with `/api/v1` must not add the API base again. Content responses are immutable and include `Cache-Control: private, max-age=31536000, immutable` plus an `ETag` derived from the asset checksum.

Stop the services with `Ctrl+C`, or run `docker compose down`. The named PostgreSQL volume is retained by default; `docker compose down -v` also deletes that development database. If you change workspace dependencies, refresh the shared Node install volume and restart the apps:

```sh
docker compose run --rm install
docker compose up
```

View a service's logs with `docker compose logs -f app` (replace `app` with `landing`, `api`, or `database`).

## Workspace layout

| Path | Nx project | Purpose |
| --- | --- | --- |
| `apps/landing` | `landing` | Public Next.js landing page, port 3001 |
| `apps/app` | `app` | MarkerIt web application, port 3000 |
| `apps/api` | `api` | Spring Boot REST API |
| `packages/ui` | `ui` | Shared React and shadcn/ui components, theme tokens, and CSS |
| `packages/validators` | `validators` | Shared Zod schemas and input types |
| `packages/api-client` | `api-client` | REST client and API error handling |
| `packages/i18n` | `i18n` | Shared English and Polish UI translations |
| `packages/config` | `config` | Shared TypeScript and ESLint configuration |

## Working with Nx

Nx models the repository as a **project graph**: projects are nodes and imports or other declared relationships are edges. Each project can expose **targets** such as `dev`, `build`, `lint`, `typecheck`, `serve`, and `test`. Nx discovers several targets from the Next.js, ESLint, and Gradle plugins; package scripts and `project.json` files define the rest.

When you run a target, Nx builds a **task graph** from the project graph and the task pipeline in `nx.json`. For example, the `build` target is configured to build dependent projects first (`dependsOn: ["^build"]`). Independent tasks run in parallel by default. Nx caches build, lint, test, and typecheck results; long-running development targets are not cached.

Run commands from the repository root using `pnpm nx`:

```sh
# List projects and inspect the targets available on a project
pnpm nx show projects
pnpm nx show project app --json

# Explore project relationships in the browser
pnpm nx graph

# Run one target for one project
pnpm nx run app:build
pnpm nx run landing:lint
pnpm nx run api:test

# Run a target across all projects that define it
pnpm nx run-many -t build
pnpm nx run-many -t lint
pnpm nx run-many -t typecheck
pnpm nx run-many -t test

# Run the unit tests with coverage thresholds
pnpm nx run-many -t test:coverage

# Run multiple targets, or limit them to selected projects
pnpm nx run-many -t lint test -p app api

# Limit parallel tasks
pnpm nx run-many -t build --parallel=2

# Preview the task graph without executing its tasks
pnpm nx run-many -t build --graph
```

`run-many` only runs targets that exist on the selected projects. For instance, the TypeScript libraries currently expose `typecheck`, while the Next.js apps expose `build` and `lint`; the Gradle plugin supplies API build and test targets. You can inspect a project's available targets with `pnpm nx show project <project-name> --json`.

## Tests and coverage

Frontend unit tests use Vitest, Testing Library, and jsdom. Backend unit tests use JUnit 5 and Mockito. Run them from the repository root:

```sh
pnpm nx run app:test
pnpm nx run api:test
pnpm nx run app:test:coverage
pnpm nx run api:test:coverage
```

The frontend coverage command enforces at least 80% statements, branches, functions, and lines. The backend JaCoCo verification is configured for at least 80% instruction coverage. The frontend suite currently has 203 tests with 91.72% statement, 82.46% branch, 83.74% function and 91.72% line coverage. The API suite has 285 tests, the JaCoCo report shows 88.09% instruction coverage, and `jacocoCoverageVerification` passes. Reports are generated under `coverage/` for the frontend and `apps/api/build/reports/jacoco/test/html/` for the API.

Full verification from a clean checkout:

```sh
pnpm nx run-many -t lint
pnpm nx run app:test:coverage
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
pnpm --filter @markerit/app exec next build
(cd apps/api && gradle test jacocoCoverageVerification --project-cache-dir /tmp/markerit-gradle-cache --rerun-tasks)
docker compose config
```

The Next.js build regenerates `apps/app/next-env.d.ts` with a production path. Keep the committed development form (`./.next/dev/types/...`) and revert that generated change if it appears in `git status`.

For CI, `affected` limits work to changes since a base revision and their dependents:

```sh
pnpm nx affected -t lint build --base=origin/main --head=HEAD
```

The default comparison base is `main` (`nx.json`). Change `origin/main` if your CI uses a different base branch.

Nx normally uses its daemon and plugin worker processes to keep graph operations fast. In restricted environments where Unix sockets are unavailable, disable the daemon for a command:

```sh
NX_DAEMON=false pnpm nx show projects
```

## Shared package usage

Workspace packages are linked with pnpm's `workspace:*` protocol and imported by their package names:

```ts
import { Button, StatusBadge } from '@markerit/ui';
import { pinCreateSchema } from '@markerit/validators';
import { apiRequest, createVersionPin } from '@markerit/api-client';
```

The API client uses `http://localhost:8080/api/v1` by default. Set `NEXT_PUBLIC_API_URL` to override it. The landing page uses `http://localhost:3000` as the application URL by default; set `NEXT_PUBLIC_APP_URL` to override it. Set `NEXT_PUBLIC_SITE_URL` to the public landing domain in production; it is used for canonical metadata, `robots.txt`, and `sitemap.xml` (the local default is `http://localhost:3001`). The application dashboard and project pages read workspaces, projects, review threads and discussion data from the API and persist all changes in PostgreSQL. Review images and comment attachments are stored in an S3-compatible bucket (MinIO locally, Cloudflare R2 in production); the database keeps their metadata. The schema reserves an `AVATAR` asset purpose, but avatar upload is not implemented yet. Project and review pages load their data on the client; the review page refreshes over the WebSocket feed.

Both Next.js apps use Tailwind CSS v4 through their PostCSS configuration. The shared shadcn/ui theme and global CSS live in `packages/ui/src/styles/globals.css` and are imported by each app. The paired `components.json` files in `apps/app`, `apps/landing`, and `packages/ui` route generated shared components to `@markerit/ui`. To add a component from the repository root, for example:

```sh
pnpm dlx shadcn@latest add button -c apps/app
```

The shared UI package exports generated components by subpath, such as `@markerit/ui/components/button`, and exports the `cn` helper as `@markerit/ui/lib/utils`.

## Product UI conventions

- Build layouts mobile-first: start with the narrow-screen layout, then add wider-screen breakpoints.
- Add user-facing text in both Polish and English to `@markerit/i18n`; avoid hard-coded interface copy in app components.
- The landing page defaults to Polish and lets visitors switch to English. Their choice is remembered in the browser.

Project tags and `@nx/enforce-module-boundaries` in the shared ESLint configuration define which projects may depend on one another. Applications are separated by scope (`scope:landing`, `scope:app`, and `scope:api`); shared libraries use `scope:shared` and type tags such as `type:ui`, `type:util`, and `type:contract`.
