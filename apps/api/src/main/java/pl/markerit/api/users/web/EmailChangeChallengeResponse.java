package pl.markerit.api.users.web;

import java.time.Instant;

public record EmailChangeChallengeResponse(
        String email,
        Instant resendAvailableAt,
        Instant expiresAt) {
}
