package pl.markerit.api.feedback.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateCommentRequest(
        @NotBlank @Size(max = 20000) String body,
        UUID parentCommentId,
        @Size(max = 10) List<UUID> attachmentAssetIds) {
}
