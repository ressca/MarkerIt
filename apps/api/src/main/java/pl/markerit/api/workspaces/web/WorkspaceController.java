package pl.markerit.api.workspaces.web;

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
import pl.markerit.api.workspaces.WorkspaceService;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaces;

    public WorkspaceController(WorkspaceService workspaces) {
        this.workspaces = workspaces;
    }

    @GetMapping
    public List<WorkspaceResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return workspaces.listForUser(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateWorkspaceRequest request) {
        return workspaces.create(CurrentUser.id(jwt), request);
    }

    @GetMapping("/{workspaceId}")
    public WorkspaceResponse get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        return workspaces.get(CurrentUser.id(jwt), workspaceId);
    }

    @PatchMapping("/{workspaceId}")
    public WorkspaceResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody UpdateWorkspaceRequest request) {
        return workspaces.update(CurrentUser.id(jwt), workspaceId, request);
    }

    @DeleteMapping("/{workspaceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        workspaces.delete(CurrentUser.id(jwt), workspaceId);
    }
}
