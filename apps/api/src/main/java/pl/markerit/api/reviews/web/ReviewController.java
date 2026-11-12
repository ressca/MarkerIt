package pl.markerit.api.reviews.web;

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
import pl.markerit.api.reviews.ReviewService;

@RestController
@RequestMapping("/api/v1")
public class ReviewController {

    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/projects/{projectId}/reviews")
    public List<ReviewSummaryResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        return reviews.list(CurrentUser.id(jwt), projectId);
    }

    @PostMapping("/projects/{projectId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateReviewRequest request) {
        return reviews.create(CurrentUser.id(jwt), projectId, request);
    }

    @GetMapping("/reviews/{reviewId}")
    public ReviewResponse get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId) {
        return reviews.get(CurrentUser.id(jwt), reviewId);
    }

    @PatchMapping("/reviews/{reviewId}")
    public ReviewResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @Valid @RequestBody UpdateReviewRequest request) {
        return reviews.update(CurrentUser.id(jwt), reviewId, request);
    }

    @PostMapping("/reviews/{reviewId}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewVersionResponse addVersion(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @Valid @RequestBody CreateVersionRequest request) {
        return reviews.addVersion(CurrentUser.id(jwt), reviewId, request);
    }

    @PostMapping("/reviews/{reviewId}/approvals")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewApprovalResponse submitApproval(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @Valid @RequestBody SubmitApprovalRequest request) {
        return reviews.submitApproval(CurrentUser.id(jwt), reviewId, request);
    }

    @PostMapping("/reviews/{reviewId}/close")
    public ReviewResponse close(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId) {
        return reviews.close(CurrentUser.id(jwt), reviewId);
    }

    @DeleteMapping("/reviews/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId) {
        reviews.delete(CurrentUser.id(jwt), reviewId);
    }
}
