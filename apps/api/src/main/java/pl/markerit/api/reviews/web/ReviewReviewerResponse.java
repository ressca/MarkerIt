package pl.markerit.api.reviews.web;

import java.time.Instant;
import java.util.UUID;

public record ReviewReviewerResponse(
        UUID userId,
        String displayName,
        String initials,
        String decision,
        String decisionNote,
        Instant decidedAt) {
}
