package pl.markerit.api.users.web;

import java.time.Instant;
import java.util.UUID;

public record UserProfileResponse(
        UUID id,
        String email,
        String displayName,
        String initials,
        String locale,
        UUID avatarAssetId,
        String avatarUrl,
        Instant createdAt) {
}
