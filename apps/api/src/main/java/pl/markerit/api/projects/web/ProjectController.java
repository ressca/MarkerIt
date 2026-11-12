package pl.markerit.api.projects.web;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.common.CurrentUser;
import pl.markerit.api.projects.ProjectService;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {

    private final ProjectService projects;

    public ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    @GetMapping("/workspaces/{workspaceId}/projects")
    public List<ProjectResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        return projects.list(CurrentUser.id(jwt), workspaceId);
    }

    @GetMapping("/projects/{projectId}")
    public ProjectResponse get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        return projects.get(CurrentUser.id(jwt), projectId);
    }

    @PostMapping("/workspaces/{workspaceId}/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody CreateProjectRequest request) {
        return projects.create(CurrentUser.id(jwt), workspaceId, request);
    }

    @PatchMapping("/projects/{projectId}")
    public ProjectResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody UpdateProjectRequest request) {
        return projects.update(CurrentUser.id(jwt), projectId, request);
    }

    @DeleteMapping("/projects/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        projects.delete(CurrentUser.id(jwt), projectId);
    }
}
