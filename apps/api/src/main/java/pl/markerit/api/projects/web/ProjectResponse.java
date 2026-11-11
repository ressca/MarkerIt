package pl.markerit.api.projects.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        UUID workspaceId,
        String name,
        String description,
        String status,
        String tone,
        UUID createdBy,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        int openComments,
        List<ProjectMemberResponse> members) {
}
