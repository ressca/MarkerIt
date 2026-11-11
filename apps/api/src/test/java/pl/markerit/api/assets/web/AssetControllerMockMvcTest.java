package pl.markerit.api.assets.web;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.assets.AssetContent;
import pl.markerit.api.assets.AssetService;
import pl.markerit.api.auth.web.ApiExceptionHandler;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;

class AssetControllerMockMvcTest {

    private AssetService assets;
    private MockMvc mockMvc;
    private UUID userId;
    private UUID projectId;
    private UUID assetId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        assets = mock(AssetService.class);
        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
        mockMvc = MockMvcBuilders.standaloneSetup(new AssetController(assets))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new JwtArgumentResolver(jwt))
                .build();
    }

    @Test void uploadsMultipartFileAndReturns201() throws Exception {
        var response = new AssetResponse(assetId, projectId, "REVIEW_IMAGE", "image/png",
                "shot.png", 2, 2, 3, "assets/" + assetId + "/content", Instant.now());
        when(assets.upload(eq(userId), eq(projectId), any(MultipartFile.class))).thenReturn(response);

        mockMvc.perform(multipart("/api/v1/projects/{projectId}/assets", projectId)
                        .file(new MockMultipartFile("file", "shot.png", "image/png", new byte[] {1, 2})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(assetId.toString()))
                .andExpect(jsonPath("$.originalName").value("shot.png"))
                .andExpect(jsonPath("$.url").value("assets/" + assetId + "/content"));
    }

    @Test void uploadsCommentAttachmentAndReturns201() throws Exception {
        var response = new AssetResponse(assetId, projectId, "ATTACHMENT", "image/png",
                "note.png", 2, 2, 2, "assets/" + assetId + "/content", Instant.now());
        when(assets.uploadAttachment(eq(userId), eq(projectId), any(MultipartFile.class)))
                .thenReturn(response);

        mockMvc.perform(multipart("/api/v1/projects/{projectId}/attachments", projectId)
                        .file(new MockMultipartFile("file", "note.png", "image/png", new byte[] {1, 2})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.purpose").value("ATTACHMENT"))
                .andExpect(jsonPath("$.originalName").value("note.png"));
    }

    @Test void returns403WhenViewerTriesToUpload() throws Exception {
        when(assets.upload(eq(userId), eq(projectId), any(MultipartFile.class)))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        mockMvc.perform(multipart("/api/v1/projects/{projectId}/assets", projectId)
                        .file(new MockMultipartFile("file", "shot.png", "image/png", new byte[] {1, 2})))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("WORKSPACE_FORBIDDEN"));
    }

    @Test void returns403WhenViewerTriesToDelete() throws Exception {
        doThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."))
                .when(assets).delete(userId, assetId);

        mockMvc.perform(delete("/api/v1/assets/{assetId}", assetId))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("WORKSPACE_FORBIDDEN"));
    }

    @Test void returns413ForOversizedUpload() throws Exception {
        when(assets.upload(eq(userId), eq(projectId), any(MultipartFile.class)))
                .thenThrow(new InvalidRequestException("ASSET_TOO_LARGE", "Plik może mieć maksymalnie 10 MB."));

        mockMvc.perform(multipart("/api/v1/projects/{projectId}/assets", projectId)
                        .file(new MockMultipartFile("file", "big.png", "image/png", new byte[] {1, 2})))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("ASSET_TOO_LARGE"));
    }

    @Test void servesImmutableContentWithCacheHeaders() throws Exception {
        when(assets.content(userId, assetId))
                .thenReturn(new AssetContent(assetId, new byte[] {1, 2, 3}, "image/png", "shot.png", "checksum"));

        mockMvc.perform(get("/api/v1/assets/{assetId}/content", assetId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        "private, max-age=31536000, immutable"))
                .andExpect(header().string(HttpHeaders.ETAG, "\"checksum\""))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"));
    }

    private record JwtArgumentResolver(Jwt jwt) implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return Jwt.class.isAssignableFrom(parameter.getParameterType());
        }

        @Override
        public Object resolveArgument(
                MethodParameter parameter,
                ModelAndViewContainer mavContainer,
                NativeWebRequest webRequest,
                WebDataBinderFactory binderFactory) {
            return jwt;
        }
    }
}
