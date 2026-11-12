package pl.markerit.api.feedback.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Coordinates are validated in the service so out-of-range values consistently
 * produce the {@code INVALID_COORDINATES} error code.
 */
public record CreatePinRequest(
        Double xPercent,
        Double yPercent,
        @NotBlank @Size(max = 20000) String body,
        @Size(max = 10) List<UUID> attachmentAssetIds) {
}
