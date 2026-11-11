-- Core tenancy: user profile fields, workspaces, projects and storage metadata.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE users
    ADD COLUMN display_name VARCHAR(80),
    ADD COLUMN locale VARCHAR(10) NOT NULL DEFAULT 'pl',
    ADD COLUMN last_seen_at TIMESTAMPTZ,
    ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE users
SET display_name = split_part(email, '@', 1)
WHERE display_name IS NULL;

ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT workspaces_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX workspaces_slug_unique ON workspaces (LOWER(slug)) WHERE deleted_at IS NULL;
CREATE INDEX workspaces_owner_id_idx ON workspaces (owner_id);

CREATE TRIGGER workspaces_set_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    invited_by UUID REFERENCES users (id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workspace_members_role_check CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id)
);

CREATE UNIQUE INDEX workspace_members_single_owner
    ON workspace_members (workspace_id) WHERE role = 'OWNER';
CREATE INDEX workspace_members_user_id_idx ON workspace_members (user_id);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(60) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    visibility VARCHAR(20) NOT NULL DEFAULT 'WORKSPACE',
    tone VARCHAR(20) NOT NULL DEFAULT 'sage',
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT projects_name_check CHECK (length(btrim(name)) >= 3),
    CONSTRAINT projects_status_check CHECK (status IN ('ACTIVE', 'IN_REVIEW', 'CLOSED')),
    CONSTRAINT projects_visibility_check CHECK (visibility IN ('WORKSPACE', 'PRIVATE')),
    CONSTRAINT projects_tone_check CHECK (tone IN ('sage', 'sand', 'blue', 'lilac', 'emerald', 'amber'))
);

CREATE UNIQUE INDEX projects_workspace_slug_unique
    ON projects (workspace_id, LOWER(slug)) WHERE deleted_at IS NULL;
CREATE INDEX projects_workspace_status_idx ON projects (workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX projects_workspace_updated_idx ON projects (workspace_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL,
    added_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_members_permission_check CHECK (permission IN ('VIEW', 'COMMENT', 'EDIT', 'ADMIN')),
    CONSTRAINT project_members_unique UNIQUE (project_id, user_id)
);

CREATE INDEX project_members_user_id_idx ON project_members (user_id);

CREATE TABLE project_favorites (
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    storage_provider VARCHAR(20) NOT NULL DEFAULT 'R2',
    storage_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 CHAR(64),
    width INTEGER,
    height INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT assets_purpose_check CHECK (purpose IN ('REVIEW_IMAGE', 'AVATAR', 'ATTACHMENT')),
    CONSTRAINT assets_kind_check CHECK (kind IN ('IMAGE', 'PDF', 'VIDEO', 'OTHER')),
    CONSTRAINT assets_storage_provider_check CHECK (storage_provider IN ('R2', 'LOCAL')),
    CONSTRAINT assets_status_check CHECK (status IN ('PENDING', 'READY', 'FAILED')),
    CONSTRAINT assets_size_check CHECK (size_bytes >= 0),
    CONSTRAINT assets_width_check CHECK (width IS NULL OR width > 0),
    CONSTRAINT assets_height_check CHECK (height IS NULL OR height > 0),
    CONSTRAINT assets_owner_check CHECK (workspace_id IS NOT NULL OR owner_user_id IS NOT NULL),
    CONSTRAINT assets_avatar_scope_check
        CHECK (purpose <> 'AVATAR' OR (owner_user_id IS NOT NULL AND workspace_id IS NULL)),
    CONSTRAINT assets_storage_unique UNIQUE (storage_provider, storage_key)
);

CREATE INDEX assets_workspace_idx ON assets (workspace_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX assets_one_avatar_per_user
    ON assets (owner_user_id) WHERE purpose = 'AVATAR' AND deleted_at IS NULL;

ALTER TABLE users
    ADD COLUMN avatar_asset_id UUID REFERENCES assets (id) ON DELETE SET NULL;

CREATE TABLE asset_variants (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    variant VARCHAR(30) NOT NULL,
    storage_key TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT asset_variants_unique UNIQUE (asset_id, variant),
    CONSTRAINT asset_variants_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

-- Hard product limits (soft-deleted rows do not consume the quota).
CREATE OR REPLACE FUNCTION enforce_workspace_limit()
RETURNS trigger AS $$
BEGIN
    IF (SELECT count(*) FROM workspaces WHERE owner_id = NEW.owner_id AND deleted_at IS NULL) >= 3 THEN
        RAISE EXCEPTION 'WORKSPACE_LIMIT_REACHED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_enforce_limit
    BEFORE INSERT ON workspaces
    FOR EACH ROW EXECUTE FUNCTION enforce_workspace_limit();

CREATE OR REPLACE FUNCTION enforce_project_limit()
RETURNS trigger AS $$
BEGIN
    IF (SELECT count(*) FROM projects WHERE workspace_id = NEW.workspace_id AND deleted_at IS NULL) >= 3 THEN
        RAISE EXCEPTION 'PROJECT_LIMIT_REACHED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_enforce_limit
    BEFORE INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION enforce_project_limit();
