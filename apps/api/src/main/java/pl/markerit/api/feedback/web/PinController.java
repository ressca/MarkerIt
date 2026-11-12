package pl.markerit.api.feedback.web;

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
import pl.markerit.api.feedback.PinService;

@RestController
@RequestMapping("/api/v1")
public class PinController {

    private final PinService feedback;

    public PinController(PinService feedback) {
        this.feedback = feedback;
    }

    @GetMapping("/reviews/{reviewId}/versions/{versionId}/pins")
    public List<PinResponse> listPins(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @PathVariable UUID versionId) {
        return feedback.listPins(CurrentUser.id(jwt), reviewId, versionId);
    }

    @PostMapping("/reviews/{reviewId}/versions/{versionId}/pins")
    @ResponseStatus(HttpStatus.CREATED)
    public PinResponse createPin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @PathVariable UUID versionId,
            @Valid @RequestBody CreatePinRequest request) {
        return feedback.createPin(CurrentUser.id(jwt), reviewId, versionId, request);
    }

    @PatchMapping("/pins/{pinId}")
    public PinResponse updatePin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID pinId,
            @Valid @RequestBody UpdatePinRequest request) {
        return feedback.updatePin(CurrentUser.id(jwt), pinId, request);
    }

    @DeleteMapping("/pins/{pinId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePin(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID pinId) {
        feedback.deletePin(CurrentUser.id(jwt), pinId);
    }

    @PostMapping("/pins/{pinId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID pinId,
            @Valid @RequestBody CreateCommentRequest request) {
        return feedback.addComment(CurrentUser.id(jwt), pinId, request);
    }

    @PatchMapping("/comments/{commentId}")
    public CommentResponse updateComment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID commentId,
            @Valid @RequestBody UpdateCommentRequest request) {
        return feedback.updateComment(CurrentUser.id(jwt), commentId, request);
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID commentId) {
        feedback.deleteComment(CurrentUser.id(jwt), commentId);
    }

    @GetMapping("/reviews/{reviewId}/versions/{versionId}/discussion")
    public DiscussionResponse discussion(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @PathVariable UUID versionId) {
        return feedback.discussion(CurrentUser.id(jwt), reviewId, versionId);
    }
}
