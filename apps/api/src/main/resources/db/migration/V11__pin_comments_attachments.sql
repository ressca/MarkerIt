-- Comment attachments: files uploaded to a project and linked to pin comments.
-- Attachments are ordered per comment; an asset is linked at most once per comment.

CREATE TABLE pin_comment_attachments (
    pin_comment_id UUID NOT NULL REFERENCES pin_comments (id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets (id) ON DELETE RESTRICT,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pin_comment_id, asset_id),
    CONSTRAINT pin_comment_attachments_position_check CHECK (position >= 0),
    CONSTRAINT pin_comment_attachments_position_unique UNIQUE (pin_comment_id, position)
);

CREATE INDEX pin_comment_attachments_asset_idx ON pin_comment_attachments (asset_id);

-- Pins are always listed for a single version in creation order.
CREATE INDEX review_pins_version_created_idx
    ON review_pins (review_version_id, created_at)
    WHERE deleted_at IS NULL;
