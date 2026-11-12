package pl.markerit.api.realtime;

import java.time.Instant;
import java.util.UUID;

/**
 * A real-time event broadcast on {@code /topic/reviews/{reviewId}}. Review,
 * version and approval events are also broadcast on
 * {@code /topic/projects/{projectId}} so project lists stay current.
 *
 * <p>{@code payloadType} identifies the shape of {@code payload} (for example
 * {@code PIN}, {@code COMMENT}, {@code REVIEW}, {@code VERSION} or
 * {@code APPROVAL}) and is {@code null} for payload-less delete events. Clients
 * can use {@code versionId} to ignore events for versions they are not
 * viewing.</p>
 */
public record ReviewRealtimeEvent(
        String type,
        UUID projectId,
        UUID reviewId,
        UUID versionId,
        UUID pinId,
        UUID commentId,
        String payloadType,
        Instant occurredAt,
        Object payload) {

    public static final String PIN_CREATED = "PIN_CREATED";
    public static final String PIN_UPDATED = "PIN_UPDATED";
    public static final String PIN_DELETED = "PIN_DELETED";
    public static final String COMMENT_CREATED = "COMMENT_CREATED";
    public static final String COMMENT_UPDATED = "COMMENT_UPDATED";
    public static final String COMMENT_DELETED = "COMMENT_DELETED";
    public static final String REVIEW_CREATED = "REVIEW_CREATED";
    public static final String REVIEW_UPDATED = "REVIEW_UPDATED";
    public static final String REVIEW_DELETED = "REVIEW_DELETED";
    public static final String VERSION_CREATED = "VERSION_CREATED";
    public static final String APPROVAL_CREATED = "APPROVAL_CREATED";

    public static final String PAYLOAD_PIN = "PIN";
    public static final String PAYLOAD_COMMENT = "COMMENT";
    public static final String PAYLOAD_REVIEW = "REVIEW";
    public static final String PAYLOAD_VERSION = "VERSION";
    public static final String PAYLOAD_APPROVAL = "APPROVAL";
}
