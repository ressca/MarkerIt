package pl.markerit.api.users.web;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 2, max = 80) String displayName,
        @Pattern(regexp = "pl|en", message = "Język musi mieć wartość pl lub en.") String locale) {
}
