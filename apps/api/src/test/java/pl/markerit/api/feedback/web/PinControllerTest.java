package pl.markerit.api.feedback.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.feedback.PinService;

class PinControllerTest {

    private PinService feedback;
    private PinController controller;
    private Jwt jwt;
    private UUID userId;
    private UUID reviewId;
    private UUID versionId;
    private UUID pinId;
    private UUID commentId;

    @BeforeEach void setUp() {
        feedback = mock(PinService.class);
        controller = new PinController(feedback);
        userId = UUID.randomUUID();
        reviewId = UUID.randomUUID();
        versionId = UUID.randomUUID();
        pinId = UUID.randomUUID();
        commentId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void delegatesPinEndpoints() {
        CreatePinRequest createPin = new CreatePinRequest(1.0, 2.0, "Treść", List.of());
        UpdatePinRequest updatePin = new UpdatePinRequest("RESOLVED");
        PinResponse pin = pinResponse();
        when(feedback.listPins(userId, reviewId, versionId)).thenReturn(List.of(pin));
        when(feedback.createPin(userId, reviewId, versionId, createPin)).thenReturn(pin);
        when(feedback.updatePin(userId, pinId, updatePin)).thenReturn(pin);

        assertEquals(List.of(pin), controller.listPins(jwt, reviewId, versionId));
        assertEquals(pin, controller.createPin(jwt, reviewId, versionId, createPin));
        assertEquals(pin, controller.updatePin(jwt, pinId, updatePin));

        controller.deletePin(jwt, pinId);
        verify(feedback).deletePin(userId, pinId);
    }

    @Test void delegatesCommentAndDiscussionEndpoints() {
        CreateCommentRequest createComment = new CreateCommentRequest("Treść", null, List.of());
        UpdateCommentRequest updateComment = new UpdateCommentRequest("Nowa");
        CommentResponse comment = commentResponse();
        DiscussionResponse discussion = new DiscussionResponse(
                reviewId, versionId, List.of(), List.of(comment), List.of());
        when(feedback.addComment(userId, pinId, createComment)).thenReturn(comment);
        when(feedback.updateComment(userId, commentId, updateComment)).thenReturn(comment);
        when(feedback.discussion(userId, reviewId, versionId)).thenReturn(discussion);

        assertEquals(comment, controller.addComment(jwt, pinId, createComment));
        assertEquals(comment, controller.updateComment(jwt, commentId, updateComment));
        assertEquals(discussion, controller.discussion(jwt, reviewId, versionId));

        controller.deleteComment(jwt, commentId);
        verify(feedback).deleteComment(userId, commentId);
    }

    private PinResponse pinResponse() {
        return new PinResponse(
                pinId,
                versionId,
                UUID.randomUUID(),
                1.0,
                2.0,
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
                List.of());
    }
}
