package pl.markerit.api.workspaces.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateWorkspaceRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description) {
}
