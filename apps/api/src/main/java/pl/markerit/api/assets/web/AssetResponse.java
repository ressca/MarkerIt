package pl.markerit.api.assets.web;

import java.time.Instant;
import java.util.UUID;

/**
 * Asset metadata returned by the API.
 *
 * <p>{@code url} is a path relative to the API base URL (for example
 * {@code assets/{id}/content}). API clients that already prefix requests with
 * {@code /api/v1} must not prepend the API base a second time.</p>
 */
public record AssetResponse(
        UUID id,
        UUID projectId,
        String purpose,
        String contentType,
        String originalName,
        long sizeBytes,
        Integer width,
        Integer height,
        String url,
        Instant createdAt) {
}
