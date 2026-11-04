package pl.markerit.api.auth.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "This field is required.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 320, message = "This value is too long.")
        String email,
        @NotBlank(message = "This field is required.")
        String password) {
}
