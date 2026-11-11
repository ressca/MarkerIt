-- The storage limit applies to review images, not to reviews/comments.
-- A project may store at most 8 review image assets; versions, pins and comments are unlimited.

DROP TRIGGER IF EXISTS reviews_enforce_limit ON reviews;
DROP FUNCTION IF EXISTS enforce_review_limit();

ALTER TABLE assets
    ADD COLUMN project_id UUID REFERENCES projects (id) ON DELETE CASCADE;

-- Backfill project ownership for assets that are already attached to a review version.
UPDATE assets a
SET project_id = source.project_id
FROM (
    SELECT DISTINCT ON (rva.asset_id) rva.asset_id, r.project_id
    FROM review_version_assets rva
    JOIN review_versions rv ON rv.id = rva.review_version_id
    JOIN reviews r ON r.id = rv.review_id
    ORDER BY rva.asset_id, rv.created_at
) source
WHERE a.id = source.asset_id
  AND a.project_id IS NULL;

ALTER TABLE assets
    ADD CONSTRAINT assets_review_project_check
        CHECK (purpose <> 'REVIEW_IMAGE' OR project_id IS NOT NULL),
    ADD CONSTRAINT assets_avatar_project_check
        CHECK (purpose <> 'AVATAR' OR project_id IS NULL);

CREATE INDEX assets_project_idx
    ON assets (project_id, created_at DESC)
    WHERE purpose = 'REVIEW_IMAGE' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_project_asset_limit()
RETURNS trigger AS $$
DECLARE
    project_workspace UUID;
BEGIN
    IF NEW.purpose <> 'REVIEW_IMAGE' THEN
        RETURN NEW;
    END IF;

    IF NEW.project_id IS NULL THEN
        RAISE EXCEPTION 'ASSET_PROJECT_REQUIRED' USING ERRCODE = '23514';
    END IF;

    SELECT workspace_id INTO project_workspace FROM projects WHERE id = NEW.project_id;
    IF project_workspace IS NULL THEN
        RAISE EXCEPTION 'ASSET_PROJECT_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    IF NEW.workspace_id IS DISTINCT FROM project_workspace THEN
        RAISE EXCEPTION 'ASSET_WORKSPACE_MISMATCH' USING ERRCODE = '23514';
    END IF;

    IF (
        SELECT count(*)
        FROM assets
        WHERE project_id = NEW.project_id
          AND purpose = 'REVIEW_IMAGE'
          AND deleted_at IS NULL
          AND id <> NEW.id
    ) >= 8 THEN
        RAISE EXCEPTION 'ASSET_LIMIT_REACHED' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_enforce_project_limit
    BEFORE INSERT OR UPDATE OF project_id, purpose, workspace_id, deleted_at ON assets
    FOR EACH ROW EXECUTE FUNCTION enforce_project_asset_limit();

CREATE OR REPLACE FUNCTION enforce_review_asset_project()
RETURNS trigger AS $$
DECLARE
    asset_project UUID;
    asset_purpose VARCHAR(20);
    review_project UUID;
BEGIN
    SELECT project_id, purpose INTO asset_project, asset_purpose
    FROM assets WHERE id = NEW.asset_id;

    SELECT r.project_id INTO review_project
    FROM review_versions rv
    JOIN reviews r ON r.id = rv.review_id
    WHERE rv.id = NEW.review_version_id;

    IF asset_purpose IS DISTINCT FROM 'REVIEW_IMAGE' THEN
        RAISE EXCEPTION 'ASSET_NOT_REVIEW_IMAGE' USING ERRCODE = '23514';
    END IF;

    IF asset_project IS NULL OR review_project IS NULL OR asset_project <> review_project THEN
        RAISE EXCEPTION 'ASSET_PROJECT_MISMATCH' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_version_assets_project_check
    BEFORE INSERT OR UPDATE ON review_version_assets
    FOR EACH ROW EXECUTE FUNCTION enforce_review_asset_project();
