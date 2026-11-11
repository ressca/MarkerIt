package pl.markerit.api.projects.web;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProjectRequest(
        @Size(min = 3, max = 50) String name,
        @Size(max = 2000) String description,
        @Pattern(regexp = "ACTIVE|IN_REVIEW|CLOSED") String status,
        @Pattern(regexp = "sage|sand|blue|lilac|emerald|amber") String tone) {
}
