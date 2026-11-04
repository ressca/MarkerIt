package pl.markerit.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "required")
        @Email(message = "invalid_email")
        @Size(max = 320, message = "too_long")
        String email,
        @NotBlank(message = "required")
        @Size(min = 12, max = 72, message = "password_length")
        String password) {
}
