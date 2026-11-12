-- Approvals are scoped to a specific review version. A new version requires
-- fresh decisions from the currently assigned reviewers.
-- NOTE: validation against a real PostgreSQL instance is deferred to the final
-- integration subtask; this migration is exercised by Flyway on application start.

ALTER TABLE review_approvals
    ADD COLUMN review_version_id UUID REFERENCES review_versions (id) ON DELETE CASCADE;

-- Backfill existing decisions with the latest version of their review.
UPDATE review_approvals approval
SET review_version_id = (
    SELECT version.id
    FROM review_versions version
    WHERE version.review_id = approval.review_id
    ORDER BY version.version_number DESC
    LIMIT 1
);

-- Rows without any review version cannot be scoped safely.
DELETE FROM review_approvals
WHERE review_version_id IS NULL;

ALTER TABLE review_approvals
    ALTER COLUMN review_version_id SET NOT NULL;

CREATE INDEX review_approvals_review_user_version_idx
    ON review_approvals (review_id, user_id, review_version_id, created_at DESC);
