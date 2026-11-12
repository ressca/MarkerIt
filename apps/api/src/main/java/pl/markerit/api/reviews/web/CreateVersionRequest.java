package pl.markerit.api.reviews.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateVersionRequest(
        @NotNull UUID assetId,
        @Size(max = 4000) String note) {
}
