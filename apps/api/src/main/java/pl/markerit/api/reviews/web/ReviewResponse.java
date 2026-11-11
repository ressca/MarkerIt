package pl.markerit.api.reviews.web;

import java.util.List;

public record ReviewResponse(
        ReviewSummaryResponse summary,
        List<ReviewReviewerResponse> reviewers,
        List<ReviewVersionResponse> versions,
        List<ReviewApprovalResponse> approvals) {
}
