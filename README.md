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
| PostgreSQL | `localhost:5432` (database/user: `markerit`, password: `markerit_dev`) |

The API waits until PostgreSQL passes its health check before starting. The database credentials are development defaults only; override `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` in a root `.env` file if needed. The API currently exposes a health endpoint and does not yet persist application data.

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

# Run multiple targets, or limit them to selected projects
pnpm nx run-many -t lint test -p app api

# Limit parallel tasks
pnpm nx run-many -t build --parallel=2

# Preview the task graph without executing its tasks
pnpm nx run-many -t build --graph
```

`run-many` only runs targets that exist on the selected projects. For instance, the TypeScript libraries currently expose `typecheck`, while the Next.js apps expose `build` and `lint`; the Gradle plugin supplies API build and test targets. You can inspect a project's available targets with `pnpm nx show project <project-name> --json`.

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
import { apiRequest, createReviewPin } from '@markerit/api-client';
```

The API client uses `http://localhost:8080/api/v1` by default. Set `NEXT_PUBLIC_API_URL` to override it. The landing page uses `http://localhost:3000` as the application URL by default; set `NEXT_PUBLIC_APP_URL` to override it. Set `NEXT_PUBLIC_SITE_URL` to the public landing domain in production; it is used for canonical metadata, `robots.txt`, and `sitemap.xml` (the local default is `http://localhost:3001`). The application dashboard currently contains static example data.

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
