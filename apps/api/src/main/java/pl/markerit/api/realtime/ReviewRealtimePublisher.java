package pl.markerit.api.realtime;

import java.time.Instant;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.markerit.api.feedback.web.CommentResponse;
import pl.markerit.api.feedback.web.PinResponse;

/**
 * Publishes review events to STOMP subscribers. Events are sent after the
 * surrounding transaction commits, so failed transactions never leak state
 * changes to connected clients.
 *
 * <p>Pin/comment events go to {@code /topic/reviews/{reviewId}}. Review,
 * version and approval events additionally go to
 * {@code /topic/projects/{projectId}} so project-level lists update without a
 * subscription per review.</p>
 */
@Service
public class ReviewRealtimePublisher {

    public static final String REVIEW_TOPIC_PREFIX = "/topic/reviews/";
    public static final String PROJECT_TOPIC_PREFIX = "/topic/projects/";

    private final SimpMessagingTemplate messaging;

    public ReviewRealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void pinCreated(UUID projectId, UUID reviewId, UUID versionId, PinResponse pin) {
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.PIN_CREATED,
                projectId,
                reviewId,
                versionId,
                pin.id(),
                null,
                ReviewRealtimeEvent.PAYLOAD_PIN,
                Instant.now(),
                pin), false);
    }

    public void pinUpdated(UUID projectId, UUID reviewId, UUID versionId, PinResponse pin) {
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.PIN_UPDATED,
                projectId,
                reviewId,
                versionId,
                pin.id(),
                null,
                ReviewRealtimeEvent.PAYLOAD_PIN,
                Instant.now(),
                pin), false);
    }

    public void pinDeleted(UUID projectId, UUID reviewId, UUID versionId, UUID pinId) {
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.PIN_DELETED,
                projectId,
                reviewId,
                versionId,
                pinId,
                null,
                null,
                Instant.now(),
                null), false);
    }

    public void commentCreated(
            UUID projectId, UUID reviewId, UUID versionId, UUID pinId, CommentResponse comment) {
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.COMMENT_CREATED,
                projectId,
                reviewId,
                versionId,
                pinId,
                comment.id(),
                ReviewRealtimeEvent.PAYLOAD_COMMENT,
                Instant.now(),
                comment), false);
    }

    public void commentUpdated(
            UUID projectId, UUID reviewId, UUID versionId, UUID pinId, CommentResponse comment) {
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.COMMENT_UPDATED,
                projectId,
                reviewId,
                versionId,
                pinId,
                comment.id(),
                ReviewRealtimeEvent.PAYLOAD_COMMENT,
                Instant.now(),
                comment), false);
    }

    public void commentDeleted(
            UUID projectId,
            UUID reviewId,
            UUID versionId,
            UUID pinId,
            CommentResponse comment) {
        // The tombstone payload keeps reply trees intact on the client.
        publish(new ReviewRealtimeEvent(
                ReviewRealtimeEvent.COMMENT_DELETED,
                projectId,
                reviewId,
                versionId,
                pinId,
                comment.id(),
                ReviewRealtimeEvent.PAYLOAD_COMMENT,
                Instant.now(),
                comment), false);
    }

    public void reviewCreated(
            UUID projectId, UUID reviewId, UUID versionId, Object payload) {
        publishReviewEvent(
                ReviewRealtimeEvent.REVIEW_CREATED, projectId, reviewId, versionId,
                ReviewRealtimeEvent.PAYLOAD_REVIEW, payload);
    }

    public void reviewUpdated(
            UUID projectId, UUID reviewId, UUID versionId, Object payload) {
        publishReviewEvent(
                ReviewRealtimeEvent.REVIEW_UPDATED, projectId, reviewId, versionId,
                ReviewRealtimeEvent.PAYLOAD_REVIEW, payload);
    }

    public void reviewDeleted(UUID projectId, UUID reviewId, UUID versionId) {
        publishReviewEvent(
                ReviewRealtimeEvent.REVIEW_DELETED, projectId, reviewId, versionId, null, null);
    }

    public void versionCreated(
            UUID projectId, UUID reviewId, UUID versionId, Object payload) {
        publishReviewEvent(
                ReviewRealtimeEvent.VERSION_CREATED, projectId, reviewId, versionId,
                ReviewRealtimeEvent.PAYLOAD_VERSION, payload);
    }

    public void approvalCreated(
            UUID projectId, UUID reviewId, UUID versionId, Object payload) {
        publishReviewEvent(
                ReviewRealtimeEvent.APPROVAL_CREATED, projectId, reviewId, versionId,
                ReviewRealtimeEvent.PAYLOAD_APPROVAL, payload);
    }

    public void publish(ReviewRealtimeEvent event) {
        publish(event, false);
    }

    private void publishReviewEvent(
            String type,
            UUID projectId,
            UUID reviewId,
            UUID versionId,
            String payloadType,
            Object payload) {
        publish(new ReviewRealtimeEvent(
                type,
                projectId,
                reviewId,
                versionId,
                null,
                null,
                payloadType,
                Instant.now(),
                payload), true);
    }

    private void publish(ReviewRealtimeEvent event, boolean includeProjectTopic) {
        Runnable send = () -> {
            messaging.convertAndSend(REVIEW_TOPIC_PREFIX + event.reviewId(), event);
            if (includeProjectTopic && event.projectId() != null) {
                messaging.convertAndSend(PROJECT_TOPIC_PREFIX + event.projectId(), event);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
