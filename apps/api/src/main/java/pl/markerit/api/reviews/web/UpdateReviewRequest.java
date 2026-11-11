package pl.markerit.api.reviews.web;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * A {@code null} field is left unchanged. Passing {@code reviewerIds} replaces
 * the current assignments; an empty list removes every reviewer.
 */
public record UpdateReviewRequest(
        @Size(max = 120) String title,
        @Size(max = 4000) String description,
        @Size(max = 20) List<UUID> reviewerIds) {
}
