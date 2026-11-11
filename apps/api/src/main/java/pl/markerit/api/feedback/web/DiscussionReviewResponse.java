package pl.markerit.api.feedback.web;

import java.time.Instant;
import java.util.UUID;

/**
 * An approval decision rendered as a review comment in the discussion feed.
 */
public record DiscussionReviewResponse(
        UUID id,
        UUID reviewId,
        UUID versionId,
        String kind,
        String decision,
        String note,
        UUID authorId,
        String authorName,
        String authorInitials,
        Instant createdAt) {
}
