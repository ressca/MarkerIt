# Project review

The project-review feature covers the project page, versioned review threads,
reviewer decisions, pins and threaded comments, comment attachments, and live
updates over STOMP. Everything is scoped to a workspace; a project belongs to a
workspace and review threads belong to a project.

## Domain model

```text
workspace
  └── project
        ├── assets (REVIEW_IMAGE / ATTACHMENT)
        └── review thread
              ├── versions 1..n ── each version points at one review image
              │     ├── pins (coordinates on that image)
              │     │     └── comments (nested, max depth 3)
              │     │           └── pin_comment_attachments
              │     └── approvals (one decision per reviewer per version)
              └── reviewers (assigned workspace members)
```

- A **review thread** is an `OPEN`/`CLOSED` container. It is always created with
  version 1. The author can add further versions; each new version starts a new
  decision round because approvals are stored with `review_version_id`.
- A **reviewer** must be an `OWNER`, `ADMIN` or `MEMBER` of the workspace.
  Replacing reviewer assignments resets decisions made before the new
  assignment, and decisions for older versions never count for the latest one.
- A **pin** is anchored to a review version at percentage coordinates
  (`xPercent`, `yPercent`, 0–100) and to that version's image. Its first comment
  is created in the same transaction.
- **Comments** form a tree (`parentCommentId`) and are limited to three levels.
  Deleted comments are returned as tombstones so replies keep their parent.
- **Comment attachments** are project assets (`purpose = ATTACHMENT`) linked
  through `pin_comment_attachments` with a stable order. They do not consume the
  review-image quota.
- **Approvals** are append-only history. The latest decision for the newest
  version determines the current reviewer state (`APPROVED`,
  `CHANGES_REQUESTED` or pending).

## Limits

| Resource | Limit | Enforcement |
| --- | --- | --- |
| Workspaces per user (owned, not deleted) | 3 | `WorkspaceService` + database trigger |
| Projects per workspace | 3 | `ProjectService` + database trigger |
| Review images (`REVIEW_IMAGE`) per project | 8 | `AssetService` + `assets_enforce_project_limit` trigger |
| Reviewers per thread | 20 | request validation + `ReviewService` |
| Attachments per comment | 10 | `PinService` + client validation |
| Review threads, versions, pins, comments | unlimited | — |
| Upload size | 10 MB per file | API + client validation |
| Image format / dimensions | PNG or JPEG; ≤ 80 MP; ≤ 12000 px per side | `AssetService` content sniffing and `ImageIO` |
| Comment nesting | 3 levels | `PinService` |

The 8-image limit is a storage limit on review images only. Uploading,
deleting, or reusing images is independent of the number of threads, versions,
pins and comments.

## Storage

Binary content lives in object storage; PostgreSQL stores asset metadata and the
storage key.

| Provider | Use |
| --- | --- |
| `S3` | Local MinIO and other S3-compatible stores (development default) |
| `R2` | Cloudflare R2 in production |
| `LOCAL` | Files on disk under `LOCAL_STORAGE_DIR` (tests and offline development) |

Relevant environment variables: `STORAGE_PROVIDER`, `S3_ENDPOINT`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_PATH_STYLE`,
`S3_PUBLIC_BASE_URL` and `LOCAL_STORAGE_DIR`. See the README for defaults.
`S3_PUBLIC_BASE_URL` is reserved and currently not used by the API.

Buckets stay private. Each asset records the provider it was written with, but
the application instantiates only the configured backend. Changing
`STORAGE_PROVIDER` therefore makes assets written by the previous provider
unreadable until that backend is configured again; there is no automatic
migration. Files are streamed through `GET /api/v1/assets/{assetId}/content`
with the `markerit_session` cookie; responses are immutable and carry an `ETag`
derived from the SHA-256 checksum. The Next.js app proxies these requests at
`/api/assets/{assetId}/content` so the browser never needs the API cookie.

Review images and comment attachments are removed from PostgreSQL and object
storage when their review thread is deleted and no other version or visible
comment references them. Objects are deleted only after the database transaction
commits.

## Realtime

The API exposes a native STOMP WebSocket at `/ws` (no SockJS). The handshake
authenticates with the same `markerit_session` cookie used by HTTP requests.
Clients subscribe to:

- `/topic/reviews/{reviewId}` — all events for one thread; this is the only
  topic the web client subscribes to today (on the review page);
- `/topic/projects/{projectId}` — review/version/approval events available for
  future project-list refreshes; the current project page does not subscribe.

Event types:

| Event | Payload |
| --- | --- |
| `PIN_CREATED`, `PIN_UPDATED` | Pin with its comments |
| `PIN_DELETED` | No payload; `pinId` identifies the pin |
| `COMMENT_CREATED`, `COMMENT_UPDATED` | Comment with attachments |
| `COMMENT_DELETED` | Comment tombstone |
| `REVIEW_CREATED`, `REVIEW_UPDATED` | Review response |
| `REVIEW_DELETED` | No payload |
| `VERSION_CREATED` | Review version |
| `APPROVAL_CREATED` | Approval response |

Every event includes `type`, `projectId`, `reviewId`, an optional `versionId`,
`occurredAt`, and optionally `pinId`/`commentId`, `payloadType` and `payload`.
Events are published after the transaction commits. The web client deduplicates
events, ignores versions it is not viewing, reconnects with exponential backoff,
and falls back to HTTP refreshes when the socket is unavailable.

## Permissions

Workspace roles are `OWNER`, `ADMIN`, `MEMBER` and `VIEWER`. Project-level
grants exist in the schema but the current review UI uses workspace roles.

| Action | Allowed |
| --- | --- |
| Read project, assets, threads, pins and discussion | any workspace member, including `VIEWER` |
| Upload review images, create/edit threads, add versions, assign reviewers | `OWNER`, `ADMIN`, `MEMBER` (author for thread edits/versions) |
| Submit approval | assigned reviewer with `OWNER`, `ADMIN` or `MEMBER` |
| Create pins, comments and replies | any workspace member while the thread is `OPEN`, including `VIEWER` |
| Resolve/reopen pins | any workspace member, including `VIEWER`, even after the thread is `CLOSED` (only creating comments/pins is blocked) |
| Edit a comment | its author |
| Delete a pin/comment | its author or a workspace `OWNER`/`ADMIN` |
| Upload/delete an unreferenced attachment | any member may delete their own unreferenced attachment; otherwise project manager |
| Close a thread | author or assigned reviewer |
| Delete a thread | author or assigned reviewer |

## Close and delete rules

A thread can be closed only when it is `OPEN` and **every currently assigned
reviewer** has approved the latest version. If no reviewers are assigned, the
author can close it. Closing records `closedAt`/`closedBy`; it does not delete
comments.

Deleting a thread permanently removes the thread, its versions, pins, comments,
approvals and reviewer assignments. Review images and comment attachments used
only by that thread are deleted from PostgreSQL and object storage, freeing
image quota slots. Assets still referenced by another version or by a visible
comment are kept. Deleted comments do not block attachment cleanup; their stale
link rows are removed first.

## Known limitations

- Deleting a project or workspace is currently a soft delete of database rows.
  It does not delete review images or attachments from object storage; those
  objects need a separate cleanup job if the workspace is permanently removed.
- The project page does not subscribe to realtime project events yet; only the
  review page listens on `/topic/reviews/{reviewId}`.
- Avatars are reserved in the schema (`assets.purpose = 'AVATAR'`) but avatar
  upload is not implemented.
- `S3_PUBLIC_BASE_URL` is reserved for a future public asset URL and is unused.
- The storage backend is chosen at startup. Switching `STORAGE_PROVIDER`
  without migrating existing objects makes assets from the old backend
  unreadable.

## API endpoints

All routes are under `/api/v1` and require an authenticated session unless noted.

### Auth and workspaces

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/auth/csrf` | Public; returns CSRF token and sets the cookie |
| `POST` | `/auth/login` | Public; CSRF required |
| `GET` | `/workspaces` | Creates the default workspace on first call |
| `POST` | `/workspaces` | Limit 3 |
| `GET`, `PATCH`, `DELETE` | `/workspaces/{workspaceId}` | |
| `GET` | `/workspaces/{workspaceId}/members` | Used for reviewer selection |

### Projects and assets

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/workspaces/{workspaceId}/projects` | Create limit 3 |
| `GET`, `PATCH`, `DELETE` | `/projects/{projectId}` | |
| `GET` | `/projects/{projectId}/assets` | Review images only |
| `POST` | `/projects/{projectId}/assets` | Multipart `file`; review image; limit 8 |
| `POST` | `/projects/{projectId}/attachments` | Multipart `file`; comment attachment |
| `GET` | `/assets/{assetId}/content` | Authenticated binary stream |
| `DELETE` | `/assets/{assetId}` | Fails with `ASSET_IN_USE` while referenced |

### Review threads

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/projects/{projectId}/reviews` | New thread requires `assetId` |
| `GET`, `PATCH`, `DELETE` | `/reviews/{reviewId}` | |
| `POST` | `/reviews/{reviewId}/versions` | `{ assetId, note }` |
| `POST` | `/reviews/{reviewId}/approvals` | `{ decision, versionId, note }`; reviewer only |
| `POST` | `/reviews/{reviewId}/close` | Requires all reviewers approved |

### Pins, comments and discussion

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/reviews/{reviewId}/versions/{versionId}/pins` | `POST` creates pin + first comment |
| `PATCH`, `DELETE` | `/pins/{pinId}` | `PATCH` changes `status` |
| `POST` | `/pins/{pinId}/comments` | Reply via `parentCommentId` |
| `PATCH`, `DELETE` | `/comments/{commentId}` | Edit body / delete |
| `GET` | `/reviews/{reviewId}/versions/{versionId}/discussion` | Combined pins, comments and approval feed |

Pin creation accepts `xPercent`, `yPercent`, `body` and up to 10
`attachmentAssetIds`. Comment creation accepts `body`, optional
`parentCommentId` and `attachmentAssetIds`. Approvals are rejected with
`REVIEW_VERSION_STALE` when the submitted `versionId` is not the newest one.
