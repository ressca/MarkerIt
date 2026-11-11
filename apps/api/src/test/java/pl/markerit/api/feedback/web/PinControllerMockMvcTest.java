package pl.markerit.api.feedback.web;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import pl.markerit.api.auth.web.ApiExceptionHandler;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.feedback.PinService;

class PinControllerMockMvcTest {

    private PinService feedback;
    private MockMvc mockMvc;
    private UUID userId;
    private UUID reviewId;
    private UUID versionId;
    private UUID pinId;
    private UUID commentId;
    private UUID assetId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        feedback = mock(PinService.class);
        userId = UUID.randomUUID();
        reviewId = UUID.randomUUID();
        versionId = UUID.randomUUID();
        pinId = UUID.randomUUID();
        commentId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
        mockMvc = MockMvcBuilders.standaloneSetup(new PinController(feedback))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new JwtArgumentResolver(jwt))
                .build();
    }

    @Test void createsPinAndReturns201() throws Exception {
        when(feedback.createPin(eq(userId), eq(reviewId), eq(versionId), any(CreatePinRequest.class)))
                .thenReturn(pinResponse());

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/versions/{versionId}/pins",
                        reviewId, versionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"xPercent":12.5,"yPercent":40,"body":"Popraw margines",
                                 "attachmentAssetIds":["%s"]}
                                """.formatted(assetId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(pinId.toString()))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.comments[0].body").value("Treść"))
                .andExpect(jsonPath("$.comments[0].attachments[0].id").value(assetId.toString()));
    }

    @Test void mapsInvalidCoordinatesError() throws Exception {
        when(feedback.createPin(eq(userId), eq(reviewId), eq(versionId), any(CreatePinRequest.class)))
                .thenThrow(new pl.markerit.api.common.InvalidRequestException(
                        "INVALID_COORDINATES", "Współrzędne poza zakresem."));

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/versions/{versionId}/pins",
                        reviewId, versionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"xPercent":120,"yPercent":40,"body":"Treść"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_COORDINATES"));
    }

    @Test void rejectsBlankCommentBody() throws Exception {
        mockMvc.perform(post("/api/v1/pins/{pinId}/comments", pinId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test void listsPinsForVersion() throws Exception {
        when(feedback.listPins(userId, reviewId, versionId)).thenReturn(List.of(pinResponse()));

        mockMvc.perform(get("/api/v1/reviews/{reviewId}/versions/{versionId}/pins",
                        reviewId, versionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(pinId.toString()));
    }

    @Test void updatesPinStatusAndDeletesPin() throws Exception {
        when(feedback.updatePin(eq(userId), eq(pinId), any(UpdatePinRequest.class)))
                .thenReturn(pinResponse());

        mockMvc.perform(patch("/api/v1/pins/{pinId}", pinId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"RESOLVED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(pinId.toString()));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", pinId))
                .andExpect(status().isNoContent());

        verify(feedback).deletePin(userId, pinId);
    }

    @Test void addsCommentAndReturns201() throws Exception {
        when(feedback.addComment(eq(userId), eq(pinId), any(CreateCommentRequest.class)))
                .thenReturn(commentResponse());

        mockMvc.perform(post("/api/v1/pins/{pinId}/comments", pinId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"Odpowiedź","parentCommentId":"%s"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pinId").value(pinId.toString()))
                .andExpect(jsonPath("$.body").value("Treść"));
    }

    @Test void updatesAndDeletesComment() throws Exception {
        when(feedback.updateComment(eq(userId), eq(commentId), any(UpdateCommentRequest.class)))
                .thenReturn(commentResponse());

        mockMvc.perform(patch("/api/v1/comments/{commentId}", commentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"Nowa treść"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(commentId.toString()));

        mockMvc.perform(delete("/api/v1/comments/{commentId}", commentId))
                .andExpect(status().isNoContent());

        verify(feedback).deleteComment(userId, commentId);
    }

    @Test void returnsDiscussionFeed() throws Exception {
        when(feedback.discussion(userId, reviewId, versionId)).thenReturn(new DiscussionResponse(
                reviewId,
                versionId,
                List.of(new DiscussionPinResponse(
                        pinId, assetId, 10, 20, "OPEN", userId, "Anna", "AK",
                        Instant.now(), null, null, null, 1)),
                List.of(commentResponse()),
                List.of(new DiscussionReviewResponse(
                        UUID.randomUUID(), reviewId, versionId, "REVIEW", "APPROVED",
                        "OK", userId, "Anna", "AK", Instant.now()))));

        mockMvc.perform(get("/api/v1/reviews/{reviewId}/versions/{versionId}/discussion",
                        reviewId, versionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pins[0].id").value(pinId.toString()))
                .andExpect(jsonPath("$.comments[0].pinId").value(pinId.toString()))
                .andExpect(jsonPath("$.reviews[0].kind").value("REVIEW"))
                .andExpect(jsonPath("$.reviews[0].decision").value("APPROVED"));
    }

    @Test void mapsPinNotFoundAndClosedReviewErrors() throws Exception {
        when(feedback.updatePin(eq(userId), eq(pinId), any(UpdatePinRequest.class)))
                .thenThrow(new ResourceNotFoundException("PIN_NOT_FOUND", "Brak pinezki."));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", pinId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"OPEN"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PIN_NOT_FOUND"));

        when(feedback.addComment(eq(userId), eq(pinId), any(CreateCommentRequest.class)))
                .thenThrow(new ConflictException("REVIEW_CLOSED", "Wątek zamknięty."));

        mockMvc.perform(post("/api/v1/pins/{pinId}/comments", pinId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"body":"Treść"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVIEW_CLOSED"));
    }

    private PinResponse pinResponse() {
        return new PinResponse(
                pinId,
                versionId,
                assetId,
                12.5,
                40,
                "OPEN",
                userId,
                "Anna",
                "AK",
                Instant.now(),
                null,
                null,
                null,
                List.of(commentResponse()));
    }

    private CommentResponse commentResponse() {
        return new CommentResponse(
                commentId,
                pinId,
                null,
                userId,
                "Anna",
                "AK",
                "Treść",
                Instant.now(),
                Instant.now(),
                null,
                false,
                List.of(new pl.markerit.api.assets.web.AssetResponse(
                        assetId, UUID.randomUUID(), "ATTACHMENT", "image/png",
                        "attachment.png", 3, 2, 2, "assets/" + assetId + "/content",
                        Instant.now())));
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
