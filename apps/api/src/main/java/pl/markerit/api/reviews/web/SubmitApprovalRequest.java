package pl.markerit.api.reviews.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SubmitApprovalRequest(
        @NotBlank String decision,
        @NotNull UUID versionId,
        @Size(max = 4000) String note) {
}
