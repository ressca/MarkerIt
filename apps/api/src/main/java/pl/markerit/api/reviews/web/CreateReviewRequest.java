package pl.markerit.api.reviews.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateReviewRequest(
        @NotBlank @Size(max = 120) String title,
        @Size(max = 4000) String description,
        @NotNull UUID assetId,
        @Size(max = 20) List<UUID> reviewerIds) {
}
