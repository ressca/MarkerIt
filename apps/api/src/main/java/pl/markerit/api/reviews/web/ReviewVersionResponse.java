package pl.markerit.api.reviews.web;

import java.time.Instant;
import java.util.UUID;
import pl.markerit.api.assets.web.AssetResponse;

public record ReviewVersionResponse(
        UUID id,
        int versionNumber,
        String note,
        AssetResponse asset,
        Instant createdAt,
        String createdByName) {
}
