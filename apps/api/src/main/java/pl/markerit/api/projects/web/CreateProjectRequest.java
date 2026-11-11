package pl.markerit.api.projects.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
        @NotBlank @Size(min = 3, max = 50) String name,
        @Size(max = 2000) String description,
        @Pattern(regexp = "sage|sand|blue|lilac|emerald|amber") String tone) {
}
