-- Collaboration, sharing, notifications, activity and audit.

CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    role VARCHAR(20) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    invited_by UUID REFERENCES users (id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workspace_invitations_role_check CHECK (role IN ('ADMIN', 'MEMBER', 'VIEWER')),
    CONSTRAINT workspace_invitations_email_normalized CHECK (email = LOWER(BTRIM(email)))
);

CREATE INDEX workspace_invitations_workspace_idx ON workspace_invitations (workspace_id);
CREATE UNIQUE INDEX workspace_invitations_pending_unique
    ON workspace_invitations (workspace_id, LOWER(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE project_invitations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    permission VARCHAR(20) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    invited_by UUID REFERENCES users (id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_invitations_permission_check CHECK (permission IN ('VIEW', 'COMMENT', 'EDIT', 'ADMIN')),
    CONSTRAINT project_invitations_email_normalized CHECK (email = LOWER(BTRIM(email)))
);

CREATE INDEX project_invitations_project_idx ON project_invitations (project_id);
CREATE UNIQUE INDEX project_invitations_pending_unique
    ON project_invitations (project_id, LOWER(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE share_links (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews (id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    permission VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT share_links_permission_check CHECK (permission IN ('VIEW', 'COMMENT')),
    CONSTRAINT share_links_target_check CHECK (num_nonnulls(project_id, review_id) = 1),
    CONSTRAINT share_links_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT share_links_use_count_check CHECK (use_count >= 0)
);

CREATE INDEX share_links_project_idx ON share_links (project_id);
CREATE INDEX share_links_review_idx ON share_links (review_id);

CREATE TABLE share_link_sessions (
    id UUID PRIMARY KEY,
    share_link_id UUID NOT NULL REFERENCES share_links (id) ON DELETE CASCADE,
    guest_name VARCHAR(80),
    guest_email VARCHAR(320),
    session_token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX share_link_sessions_link_idx ON share_link_sessions (share_link_id);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews (id) ON DELETE CASCADE,
    pin_id UUID REFERENCES review_pins (id) ON DELETE CASCADE,
    comment_id UUID REFERENCES pin_comments (id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, type, channel),
    CONSTRAINT notification_preferences_channel_check CHECK (channel IN ('IN_APP', 'EMAIL'))
);

CREATE TABLE email_outbox (
    id UUID PRIMARY KEY,
    to_email VARCHAR(320) NOT NULL,
    template VARCHAR(60) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_outbox_status_check CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    CONSTRAINT email_outbox_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX email_outbox_queue_idx ON email_outbox (status, next_attempt_at);

CREATE TABLE activity_events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects (id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    type VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX activity_events_workspace_idx ON activity_events (workspace_id, created_at DESC);
CREATE INDEX activity_events_project_idx ON activity_events (project_id, created_at DESC);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(40),
    target_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX audit_events_workspace_idx ON audit_events (workspace_id, created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, created_at DESC);
