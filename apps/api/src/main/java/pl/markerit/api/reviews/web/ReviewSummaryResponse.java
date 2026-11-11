package pl.markerit.api.reviews.web;

import java.time.Instant;
import java.util.UUID;

public record ReviewSummaryResponse(
        UUID id,
        UUID projectId,
        String title,
        String description,
        String status,
        UUID createdBy,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        Instant closedAt,
        UUID closedBy,
        String closedByName,
        ReviewVersionResponse latestVersion,
        int reviewerCount,
        ReviewApprovalSummaryResponse approvalSummary) {
}
