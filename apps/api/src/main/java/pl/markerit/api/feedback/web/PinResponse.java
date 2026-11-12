package pl.markerit.api.feedback.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A pin with its full visible comment thread.
 *
 * <p>{@code comments} is ordered chronologically. Attachments are returned as
 * regular asset metadata; clients load their bytes from {@code asset.url}.</p>
 */
public record PinResponse(
        UUID id,
        UUID reviewVersionId,
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
        List<CommentResponse> comments) {
}
