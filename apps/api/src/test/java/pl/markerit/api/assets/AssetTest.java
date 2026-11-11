package pl.markerit.api.assets;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AssetTest {

    @Test void createsReadyReviewImage() {
        UUID workspaceId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        Asset asset = new Asset(workspaceId, projectId, userId, "S3", "projects/p/a.png",
                "a.png", "image/png", 12, 2, 3, Map.of("originalName", "a.png"));
        asset.onCreate();

        assertNotNull(asset.getId());
        assertEquals(workspaceId, asset.getWorkspaceId());
        assertEquals(projectId, asset.getProjectId());
        assertEquals(userId, asset.getOwnerUserId());
        assertEquals(Asset.PURPOSE_REVIEW_IMAGE, asset.getPurpose());
        assertEquals(Asset.KIND_IMAGE, asset.getKind());
        assertEquals("S3", asset.getStorageProvider());
        assertEquals("projects/p/a.png", asset.getStorageKey());
        assertEquals("a.png", asset.getOriginalName());
        assertEquals("image/png", asset.getContentType());
        assertEquals(12, asset.getSizeBytes());
        assertEquals(2, asset.getWidth());
        assertEquals(3, asset.getHeight());
        assertEquals(Asset.STATUS_READY, asset.getStatus());
        assertEquals("a.png", asset.getMetadata().get("originalName"));
        assertNotNull(asset.getCreatedAt());
        assertNull(asset.getDeletedAt());
        assertNull(asset.getChecksumSha256());
    }

    @Test void storesChecksumProvidedByUpload() {
        Asset asset = new Asset(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "S3",
                "projects/p/a.png", "a.png", "image/png", 12, 2, 3, Map.of(), "abc123");

        assertEquals("abc123", asset.getChecksumSha256());
    }
}
