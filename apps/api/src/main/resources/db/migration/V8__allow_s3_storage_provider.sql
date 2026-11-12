-- S3 is a valid provider for S3-compatible object stores such as MinIO.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_storage_provider_check;
ALTER TABLE assets ADD CONSTRAINT assets_storage_provider_check
    CHECK (storage_provider IN ('R2', 'S3', 'LOCAL'));
