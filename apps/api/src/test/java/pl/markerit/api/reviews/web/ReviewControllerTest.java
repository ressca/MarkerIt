package pl.markerit.api.reviews.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.reviews.ReviewService;

class ReviewControllerTest {

    private ReviewService reviews;
    private ReviewController controller;
    private UUID userId;
    private UUID projectId;
    private UUID reviewId;
    private UUID assetId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        reviews = mock(ReviewService.class);
        controller = new ReviewController(reviews);
        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        reviewId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void listsAndCreatesThreads() {
        ReviewSummaryResponse summary = summary();
        ReviewResponse response = response(summary);
        CreateReviewRequest createRequest = new CreateReviewRequest(
                "Recenzja", null, assetId, List.of());
        when(reviews.list(userId, projectId)).thenReturn(List.of(summary));
        when(reviews.create(userId, projectId, createRequest)).thenReturn(response);

        assertEquals(List.of(summary), controller.list(jwt, projectId));
        assertEquals(response, controller.create(jwt, projectId, createRequest));
    }

    @Test void readsAndUpdatesThread() {
        ReviewResponse response = response(summary());
        UpdateReviewRequest updateRequest = new UpdateReviewRequest("Nowy", null, null);
        when(reviews.get(userId, reviewId)).thenReturn(response);
        when(reviews.update(userId, reviewId, updateRequest)).thenReturn(response);

        assertEquals(response, controller.get(jwt, reviewId));
        assertEquals(response, controller.update(jwt, reviewId, updateRequest));
    }

    @Test void addsVersionAndSubmitsApproval() {
        ReviewVersionResponse version = new ReviewVersionResponse(
                UUID.randomUUID(), 2, "nota", null, Instant.now(), "Anna");
        ReviewApprovalResponse approval = new ReviewApprovalResponse(
                userId, "Anna", UUID.randomUUID(), "APPROVED", "ok", Instant.now());
        CreateVersionRequest versionRequest = new CreateVersionRequest(assetId, "nota");
        SubmitApprovalRequest approvalRequest = new SubmitApprovalRequest("APPROVED", "ok");
        when(reviews.addVersion(userId, reviewId, versionRequest)).thenReturn(version);
        when(reviews.submitApproval(userId, reviewId, approvalRequest)).thenReturn(approval);

        assertEquals(version, controller.addVersion(jwt, reviewId, versionRequest));
        assertEquals(approval, controller.submitApproval(jwt, reviewId, approvalRequest));
    }

    @Test void closesAndDeletesThread() {
        ReviewResponse response = response(summary());
        when(reviews.close(userId, reviewId)).thenReturn(response);

        assertEquals(response, controller.close(jwt, reviewId));

        controller.delete(jwt, reviewId);
        verify(reviews).delete(userId, reviewId);
    }

    private ReviewSummaryResponse summary() {
        return new ReviewSummaryResponse(
                reviewId,
                projectId,
                "Recenzja",
                null,
                "OPEN",
                userId,
                "Anna",
                Instant.now(),
                Instant.now(),
                null,
                null,
                null,
                null,
                0,
                new ReviewApprovalSummaryResponse(0, 0, 0, 0));
    }

    private ReviewResponse response(ReviewSummaryResponse summary) {
        return new ReviewResponse(summary, List.of(), List.of(), List.of());
    }
}
