package pl.markerit.api.users.web;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VerifyEmailChangeRequest(
        @NotBlank @Email @Size(max = 320) String newEmail,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$") String code) {
}
