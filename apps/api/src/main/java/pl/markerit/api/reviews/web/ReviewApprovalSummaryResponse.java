package pl.markerit.api.reviews.web;

/**
 * Counts only current reviewers. Approvals from reviewers removed from the
 * thread stay in the approval history but are not part of this summary.
 */
public record ReviewApprovalSummaryResponse(
        int approved,
        int changesRequested,
        int pending,
        int total) {
}
