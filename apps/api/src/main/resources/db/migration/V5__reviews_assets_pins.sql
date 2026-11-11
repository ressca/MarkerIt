-- Review flow: files are versioned, pins belong to a version/asset, comments belong to pins.

CREATE TABLE reviews (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT reviews_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT reviews_status_check CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE INDEX reviews_project_status_idx ON reviews (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX reviews_project_updated_idx ON reviews (project_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER reviews_set_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE review_versions (
    id UUID PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    note TEXT,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_versions_number_check CHECK (version_number > 0),
    CONSTRAINT review_versions_unique UNIQUE (review_id, version_number)
);

CREATE TABLE review_version_assets (
    review_version_id UUID NOT NULL REFERENCES review_versions (id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets (id) ON DELETE RESTRICT,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (review_version_id, asset_id),
    CONSTRAINT review_version_assets_position_check CHECK (position >= 0),
    CONSTRAINT review_version_assets_position_unique UNIQUE (review_version_id, position)
);

CREATE INDEX review_version_assets_asset_idx ON review_version_assets (asset_id);

CREATE TABLE review_pins (
    id UUID PRIMARY KEY,
    review_version_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    x_percent NUMERIC(6, 3) NOT NULL,
    y_percent NUMERIC(6, 3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT review_pins_x_range CHECK (x_percent BETWEEN 0 AND 100),
    CONSTRAINT review_pins_y_range CHECK (y_percent BETWEEN 0 AND 100),
    CONSTRAINT review_pins_status_check CHECK (status IN ('OPEN', 'RESOLVED')),
    CONSTRAINT review_pins_version_asset_fk
        FOREIGN KEY (review_version_id, asset_id)
        REFERENCES review_version_assets (review_version_id, asset_id) ON DELETE CASCADE
);

CREATE INDEX review_pins_version_status_idx ON review_pins (review_version_id, status) WHERE deleted_at IS NULL;
CREATE INDEX review_pins_asset_idx ON review_pins (asset_id) WHERE deleted_at IS NULL;

CREATE TABLE pin_comments (
    id UUID PRIMARY KEY,
    pin_id UUID NOT NULL REFERENCES review_pins (id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES pin_comments (id) ON DELETE CASCADE,
    author_id UUID REFERENCES users (id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT pin_comments_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX pin_comments_pin_idx ON pin_comments (pin_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX pin_comments_parent_idx ON pin_comments (parent_comment_id);

CREATE TRIGGER pin_comments_set_updated_at
    BEFORE UPDATE ON pin_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE pin_comment_mentions (
    pin_comment_id UUID NOT NULL REFERENCES pin_comments (id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (pin_comment_id, mentioned_user_id)
);

CREATE INDEX pin_comment_mentions_user_idx ON pin_comment_mentions (mentioned_user_id);

CREATE TABLE pin_comment_reactions (
    pin_comment_id UUID NOT NULL REFERENCES pin_comments (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pin_comment_id, user_id, emoji)
);

CREATE TABLE review_approvals (
    id UUID PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    decision VARCHAR(30) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_approvals_decision_check CHECK (decision IN ('APPROVED', 'CHANGES_REQUESTED'))
);

CREATE INDEX review_approvals_review_idx ON review_approvals (review_id, created_at DESC);

CREATE TABLE tags (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT 'sage',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tags_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX tags_workspace_name_unique ON tags (workspace_id, LOWER(name));

CREATE TABLE project_tags (
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

CREATE INDEX project_tags_tag_idx ON project_tags (tag_id);

-- Each project can hold at most 8 image reviews.
CREATE OR REPLACE FUNCTION enforce_review_limit()
RETURNS trigger AS $$
BEGIN
    IF (SELECT count(*) FROM reviews WHERE project_id = NEW.project_id AND deleted_at IS NULL) >= 8 THEN
        RAISE EXCEPTION 'REVIEW_LIMIT_REACHED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_enforce_limit
    BEFORE INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION enforce_review_limit();
