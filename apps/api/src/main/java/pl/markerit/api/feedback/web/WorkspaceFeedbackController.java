package pl.markerit.api.feedback.web;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.common.CurrentUser;
import pl.markerit.api.feedback.WorkspaceFeedbackService;

@RestController
@RequestMapping("/api/v1")
public class WorkspaceFeedbackController {

    private final WorkspaceFeedbackService feedback;

    public WorkspaceFeedbackController(WorkspaceFeedbackService feedback) {
        this.feedback = feedback;
    }

    @GetMapping("/workspaces/{workspaceId}/feedback")
    public List<WorkspaceFeedbackResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID workspaceId) {
        return feedback.list(CurrentUser.id(jwt), workspaceId);
    }
}
