package pl.markerit.api.feedback.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A pin marker in a version discussion. Comments are returned separately in
 * {@link DiscussionResponse#comments()} and reference the pin through
 * {@code pinId}, which keeps payloads small and lets the frontend keep marker
 * highlighting in sync with the comment list. {@code commentCount} counts only
 * visible (non-deleted) comments; deleted comments remain in the feed as
 * redacted tombstones so replies are not orphaned.
 */
public record DiscussionPinResponse(
        UUID id,
        UUID assetId,
        double xPercent,
        double yPercent,
        String status,
        UUID authorId,
        String authorName,
        String authorInitials,
        Instant createdAt,
        UUID resolvedBy,
        String resolvedByName,
        Instant resolvedAt,
        int commentCount) {
}
