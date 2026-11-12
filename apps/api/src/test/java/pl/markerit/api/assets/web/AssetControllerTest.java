package pl.markerit.api.assets.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.assets.AssetContent;
import pl.markerit.api.assets.AssetService;

class AssetControllerTest {

    private AssetService assets;
    private AssetController controller;
    private UUID userId;
    private UUID projectId;
    private UUID assetId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        assets = mock(AssetService.class);
        controller = new AssetController(assets);
        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void uploadsMultipartFile() {
        var file = new MockMultipartFile("file", "shot.png", "image/png", new byte[] {1});
        var response = new AssetResponse(assetId, projectId, "REVIEW_IMAGE", "image/png",
                "shot.png", 1, 1, 1, "assets/" + assetId + "/content", Instant.now());
        when(assets.upload(userId, projectId, file)).thenReturn(response);

        assertEquals(response, controller.upload(jwt, projectId, file));
    }

    @Test void listsProjectAssets() {
        var response = new AssetResponse(assetId, projectId, "REVIEW_IMAGE", "image/png",
                "shot.png", 1, 1, 1, "assets/" + assetId + "/content", Instant.now());
        when(assets.list(userId, projectId)).thenReturn(List.of(response));

        assertEquals(List.of(response), controller.list(jwt, projectId));
    }

    @Test void streamsAssetContentWithCacheAndEtag() {
        byte[] data = {1, 2, 3};
        when(assets.content(userId, assetId))
                .thenReturn(new AssetContent(assetId, data, "image/png", "zażółć.png", "abc123"));

        var response = controller.content(jwt, assetId);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(MediaType.IMAGE_PNG, response.getHeaders().getContentType());
        assertEquals(3, response.getHeaders().getContentLength());
        assertEquals("private, max-age=31536000, immutable",
                response.getHeaders().getCacheControl());
        assertEquals("\"abc123\"", response.getHeaders().getETag());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).startsWith("inline"));
        assertTrue(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).contains("UTF-8"));
        assertArrayEquals(data, response.getBody());
    }

    @Test void fallsBackToAssetIdForEtagWhenChecksumIsMissing() {
        when(assets.content(userId, assetId))
                .thenReturn(new AssetContent(assetId, new byte[] {1}, "image/png", "shot.png", null));

        var response = controller.content(jwt, assetId);

        assertEquals("\"" + assetId + "\"", response.getHeaders().getETag());
    }

    @Test void deletesAsset() {
        controller.delete(jwt, assetId);

        verify(assets).delete(userId, assetId);
    }
}
