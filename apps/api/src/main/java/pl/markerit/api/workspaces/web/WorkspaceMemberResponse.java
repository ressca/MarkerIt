package pl.markerit.api.workspaces.web;

import java.util.UUID;

public record WorkspaceMemberResponse(
        UUID id,
        String displayName,
        String email,
        String initials,
        String role) {
}
