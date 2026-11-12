package pl.markerit.api.feedback.web;

import jakarta.validation.constraints.NotBlank;

public record UpdatePinRequest(@NotBlank String status) {
}
