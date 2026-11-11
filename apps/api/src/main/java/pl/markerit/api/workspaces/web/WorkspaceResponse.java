package pl.markerit.api.workspaces.web;

import java.time.Instant;
import java.util.UUID;

public record WorkspaceResponse(
        UUID id,
        String name,
        String description,
        String role,
        long projectCount,
        Instant createdAt,
        Instant updatedAt) {
}
