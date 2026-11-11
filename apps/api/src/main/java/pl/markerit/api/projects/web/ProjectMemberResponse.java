package pl.markerit.api.projects.web;

import java.util.UUID;

public record ProjectMemberResponse(
        UUID id,
        String displayName,
        String initials) {
}
