package pl.markerit.api.feedback.web;

import java.util.List;
import java.util.UUID;

/**
 * Combined discussion feed for one review version.
 *
 * <ul>
 *   <li>{@code pins} – markers on the version's image, without comments, for
 *       rendering the marker layer.</li>
 *   <li>{@code comments} – all comments across pins in chronological order.
 *       Every comment carries {@code pinId} so hovering a comment can highlight
 *       the matching pin marker (and vice versa).</li>
 *   <li>{@code reviews} – approval decisions for the version, marked with
 *       {@code kind = "REVIEW"} so clients render them as review comments.</li>
 * </ul>
 */
public record DiscussionResponse(
        UUID reviewId,
        UUID versionId,
        List<DiscussionPinResponse> pins,
        List<CommentResponse> comments,
        List<DiscussionReviewResponse> reviews) {
}
