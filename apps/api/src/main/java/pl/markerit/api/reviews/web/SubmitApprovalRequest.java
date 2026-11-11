package pl.markerit.api.reviews.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitApprovalRequest(
        @NotBlank String decision,
        @Size(max = 4000) String note) {
}
