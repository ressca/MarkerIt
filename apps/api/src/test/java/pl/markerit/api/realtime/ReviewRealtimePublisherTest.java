package pl.markerit.api.realtime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.markerit.api.feedback.web.CommentResponse;
import pl.markerit.api.feedback.web.PinResponse;

class ReviewRealtimePublisherTest {

    private SimpMessagingTemplate messaging;
    private ReviewRealtimePublisher publisher;
    private UUID projectId;
    private UUID reviewId;
    private UUID versionId;
    private UUID pinId;
    private UUID commentId;
    private PinResponse pin;
    private CommentResponse comment;

    @BeforeEach void setUp() {
        messaging = mock(SimpMessagingTemplate.class);
        publisher = new ReviewRealtimePublisher(messaging);
        projectId = UUID.randomUUID();
        reviewId = UUID.randomUUID();
        versionId = UUID.randomUUID();
        pinId = UUID.randomUUID();
        commentId = UUID.randomUUID();
        pin = new PinResponse(pinId, versionId, UUID.randomUUID(), 5, 6, "OPEN",
                UUID.randomUUID(), "Anna", "AK", Instant.now(), null, null, null, List.of());
        comment = new CommentResponse(commentId, pinId, null, UUID.randomUUID(), "Anna", "AK",
                "Treść", Instant.now(), Instant.now(), null, false, List.of());
    }

    @AfterEach void cleanTransactions() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test void publishesPinEventsOnlyToReviewTopic() {
        publisher.pinCreated(projectId, reviewId, versionId, pin);
        publisher.pinUpdated(projectId, reviewId, versionId, pin);
        publisher.pinDeleted(projectId, reviewId, versionId, pinId);

        ArgumentCaptor<ReviewRealtimeEvent> captor =
                ArgumentCaptor.forClass(ReviewRealtimeEvent.class);
        verify(messaging, times(3)).convertAndSend(
                eq("/topic/reviews/" + reviewId), captor.capture());
        verify(messaging, never()).convertAndSend(
                eq("/topic/projects/" + projectId), any(ReviewRealtimeEvent.class));
        List<ReviewRealtimeEvent> events = captor.getAllValues();
        assertEquals("PIN_CREATED", events.get(0).type());
        assertEquals(pin, events.get(0).payload());
        assertEquals("PIN", events.get(0).payloadType());
        assertEquals(projectId, events.get(0).projectId());
        assertEquals(versionId, events.get(0).versionId());
        assertEquals(pinId, events.get(0).pinId());
        assertEquals("PIN_UPDATED", events.get(1).type());
        assertEquals("PIN_DELETED", events.get(2).type());
        assertNull(events.get(2).payload());
        assertNull(events.get(2).payloadType());
    }

    @Test void publishesCommentEventsIncludingDeleteTombstone() {
        publisher.commentCreated(projectId, reviewId, versionId, pinId, comment);
        publisher.commentUpdated(projectId, reviewId, versionId, pinId, comment);
        publisher.commentDeleted(projectId, reviewId, versionId, pinId, comment);

        ArgumentCaptor<ReviewRealtimeEvent> captor =
                ArgumentCaptor.forClass(ReviewRealtimeEvent.class);
        verify(messaging, times(3)).convertAndSend(
                eq("/topic/reviews/" + reviewId), captor.capture());
        List<ReviewRealtimeEvent> events = captor.getAllValues();
        assertEquals("COMMENT_CREATED", events.get(0).type());
        assertEquals(commentId, events.get(0).commentId());
        assertEquals(pinId, events.get(0).pinId());
        assertEquals("COMMENT_UPDATED", events.get(1).type());
        assertEquals("COMMENT_DELETED", events.get(2).type());
        assertEquals(commentId, events.get(2).commentId());
        assertEquals(comment, events.get(2).payload());
        assertEquals("COMMENT", events.get(2).payloadType());
    }

    @Test void publishesReviewVersionAndApprovalEventsToBothTopics() {
        publisher.reviewCreated(projectId, reviewId, versionId, "review-created");
        publisher.reviewUpdated(projectId, reviewId, versionId, "review-updated");
        publisher.reviewDeleted(projectId, reviewId, versionId);
        publisher.versionCreated(projectId, reviewId, versionId, "version");
        publisher.approvalCreated(projectId, reviewId, versionId, "approval");

        ArgumentCaptor<ReviewRealtimeEvent> captor =
                ArgumentCaptor.forClass(ReviewRealtimeEvent.class);
        verify(messaging, times(5)).convertAndSend(
                eq("/topic/reviews/" + reviewId), captor.capture());
        verify(messaging, times(5)).convertAndSend(
                eq("/topic/projects/" + projectId), any(ReviewRealtimeEvent.class));

        List<ReviewRealtimeEvent> events = captor.getAllValues();
        assertEquals("REVIEW_CREATED", events.get(0).type());
        assertEquals("REVIEW", events.get(0).payloadType());
        assertEquals("REVIEW_UPDATED", events.get(1).type());
        assertEquals("REVIEW_DELETED", events.get(2).type());
        assertNull(events.get(2).payload());
        assertEquals("VERSION_CREATED", events.get(3).type());
        assertEquals("VERSION", events.get(3).payloadType());
        assertEquals("APPROVAL_CREATED", events.get(4).type());
        assertEquals("APPROVAL", events.get(4).payloadType());
        assertEquals(projectId, events.get(4).projectId());
    }

    @Test void defersPublishingUntilTransactionCommit() {
        TransactionSynchronizationManager.initSynchronization();
        publisher.pinCreated(projectId, reviewId, versionId, pin);

        verifyNoInteractions(messaging);

        for (TransactionSynchronization synchronization
                : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }

        verify(messaging).convertAndSend(eq("/topic/reviews/" + reviewId),
                any(ReviewRealtimeEvent.class));
    }
}
