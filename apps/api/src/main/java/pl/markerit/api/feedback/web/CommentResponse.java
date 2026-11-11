package pl.markerit.api.feedback.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.markerit.api.assets.web.AssetResponse;

/**
 * A single pin comment. {@code pinId} is always present so the frontend can
 * highlight the matching pin marker while hovering a comment.
 */
public record CommentResponse(
        UUID id,
        UUID pinId,
        UUID parentCommentId,
        UUID authorId,
        String authorName,
        String authorInitials,
        String body,
        Instant createdAt,
        Instant updatedAt,
        Instant editedAt,
        boolean deleted,
        List<AssetResponse> attachments) {
}
