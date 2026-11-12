package pl.markerit.api.workspaces.web;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.common.CurrentUser;
import pl.markerit.api.workspaces.WorkspaceMemberService;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceMemberController {

    private final WorkspaceMemberService members;

    public WorkspaceMemberController(WorkspaceMemberService members) {
        this.members = members;
    }

    @GetMapping("/{workspaceId}/members")
    public List<WorkspaceMemberResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        return members.list(CurrentUser.id(jwt), workspaceId);
    }
}
