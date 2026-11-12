package pl.markerit.api.reviews.web;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.reviews.ReviewService;

class ReviewControllerMockMvcTest {

    private ReviewService reviews;
    private MockMvc mockMvc;
    private UUID userId;
    private UUID projectId;
    private UUID reviewId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        reviews = mock(ReviewService.class);
        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        reviewId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
        mockMvc = MockMvcBuilders.standaloneSetup(new ReviewController(reviews))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new JwtArgumentResolver(jwt))
                .build();
    }

    @Test void createsThreadAndReturns201() throws Exception {
        when(reviews.create(eq(userId), eq(projectId), any(CreateReviewRequest.class)))
                .thenReturn(response());

        mockMvc.perform(post("/api/v1/projects/{projectId}/reviews", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Recenzja","description":"Opis","assetId":"%s","reviewerIds":[]}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.summary.id").value(reviewId.toString()))
                .andExpect(jsonPath("$.summary.title").value("Recenzja"));
    }

    @Test void returns403ForNonReviewerApproval() throws Exception {
        when(reviews.submitApproval(eq(userId), eq(reviewId), any(SubmitApprovalRequest.class)))
                .thenThrow(new ForbiddenAccessException("REVIEW_FORBIDDEN", "Brak uprawnień."));

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/approvals", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision":"APPROVED","versionId":"%s"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("REVIEW_FORBIDDEN"));
    }

    @Test void returns409WhenApprovalVersionIsStale() throws Exception {
        when(reviews.submitApproval(eq(userId), eq(reviewId), any(SubmitApprovalRequest.class)))
                .thenThrow(new ConflictException("REVIEW_VERSION_STALE", "Nowa wersja."));

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/approvals", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision":"APPROVED","versionId":"%s"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVIEW_VERSION_STALE"));
    }

    @Test void approvalResponseIncludesVersionId() throws Exception {
        UUID versionId = UUID.randomUUID();
        when(reviews.submitApproval(eq(userId), eq(reviewId), any(SubmitApprovalRequest.class)))
                .thenReturn(new ReviewApprovalResponse(
                        userId, "Anna", versionId, "APPROVED", null, Instant.now()));

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/approvals", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision":"APPROVED","versionId":"%s"}
                                """.formatted(versionId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionId").value(versionId.toString()));
    }

    @Test void rejectsTooManyReviewers() throws Exception {
        String reviewerIds = java.util.stream.IntStream.range(0, 21)
                .mapToObj(index -> "\"" + UUID.randomUUID() + "\"")
                .collect(java.util.stream.Collectors.joining(","));

        mockMvc.perform(post("/api/v1/projects/{projectId}/reviews", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Recenzja","assetId":"%s","reviewerIds":[%s]}
                                """.formatted(UUID.randomUUID(), reviewerIds)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(reviews, never()).create(any(), any(), any());
    }

    @Test void returns409WhenThreadIsNotApproved() throws Exception {
        when(reviews.close(userId, reviewId))
                .thenThrow(new ConflictException("REVIEW_NOT_APPROVED", "Nie wszyscy zatwierdzili."));

        mockMvc.perform(post("/api/v1/reviews/{reviewId}/close", reviewId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVIEW_NOT_APPROVED"));
    }

    @Test void deletesThreadAndReturns204() throws Exception {
        mockMvc.perform(delete("/api/v1/reviews/{reviewId}", reviewId))
                .andExpect(status().isNoContent());

        verify(reviews).delete(userId, reviewId);
    }

    @Test void returnsThreadDetail() throws Exception {
        when(reviews.get(userId, reviewId)).thenReturn(response());

        mockMvc.perform(get("/api/v1/reviews/{reviewId}", reviewId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.id").value(reviewId.toString()))
                .andExpect(jsonPath("$.reviewers").isArray());
    }

    private ReviewResponse response() {
        ReviewSummaryResponse summary = new ReviewSummaryResponse(
                reviewId,
                projectId,
                "Recenzja",
                "Opis",
                "OPEN",
                userId,
                "Anna",
                Instant.now(),
                Instant.now(),
                null,
                null,
                null,
                null,
                List.of(),
                0,
                new ReviewApprovalSummaryResponse(0, 0, 0, 0));
        return new ReviewResponse(summary, List.of(), List.of(), List.of());
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
