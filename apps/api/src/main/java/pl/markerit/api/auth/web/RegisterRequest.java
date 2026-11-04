package pl.markerit.api.auth.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "This field is required.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 320, message = "This value is too long.")
        String email,
        @NotBlank(message = "This field is required.")
        @Size(min = 12, max = 72, message = "Use a password between 12 and 72 characters.")
        String password) {
}
