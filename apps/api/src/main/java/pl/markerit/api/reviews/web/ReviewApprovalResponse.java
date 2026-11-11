package pl.markerit.api.reviews.web;

import java.time.Instant;
import java.util.UUID;

public record ReviewApprovalResponse(
        UUID userId,
        String displayName,
        UUID versionId,
        String decision,
        String note,
        Instant createdAt) {
}
