package pl.markerit.api.feedback.web;

import java.time.Instant;
import java.util.UUID;
import pl.markerit.api.assets.web.AssetResponse;

/**
 * One pin from a workspace project, enriched with the project, review and
 * latest-version context needed by the workspace feedback inbox.
 *
 * <p>The list contains pins from the latest version of every review in the
 * workspace, including closed reviews so history stays searchable. Clients
 * decide which statuses to surface and can link each item back to its review
 * thread.</p>
 */
public record WorkspaceFeedbackResponse(
        UUID id,
        UUID projectId,
        String projectName,
        String projectTone,
        UUID reviewId,
        String reviewTitle,
        String reviewStatus,
        UUID versionId,
        int versionNumber,
        AssetResponse asset,
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
        int commentCount,
        String lastCommentBody,
        String lastCommentAuthorName,
        String lastCommentAuthorInitials,
        Instant lastCommentAt) {
}
