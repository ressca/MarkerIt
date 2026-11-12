package pl.markerit.api.auth.web;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.PropertyAccessorFactory;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.EmailNotVerifiedException;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.PasswordPolicyException;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;

class ApiExceptionHandlerTest {
    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test void mapsRequestValidationToEnglishProblemDetails() {
        Object target = new Object();
        BeanPropertyBindingResult binding = new BeanPropertyBindingResult(target, "request");
        binding.addError(new FieldError("request", "email", "bad", false, null, null, "Enter a valid email address."));
        var response = handler.invalidRequest(new MethodArgumentNotValidException(null, binding));
        assertEquals(400, response.getStatusCode().value());
        assertEquals("INVALID_REQUEST", response.getBody().getTitle());
        assertEquals("The submitted data is invalid.", response.getBody().getDetail());
        assertEquals("email", ((Map<?, ?>)((java.util.List<?>)response.getBody().getProperties().get("fieldErrors")).getFirst()).get("field"));
    }

    @Test void mapsKnownAuthenticationAndRegistrationErrors() {
        assertEquals(401, handler.invalidCredentials().getStatusCode().value());
        assertEquals("INVALID_CREDENTIALS", handler.invalidCredentials().getBody().getProperties().get("code"));
        assertEquals(409, handler.duplicateEmail().getStatusCode().value());
        assertEquals("EMAIL_ALREADY_REGISTERED",
                handler.duplicateEmail().getBody().getProperties().get("code"));
        var constraint = handler.constraintViolation();
        assertEquals(409, constraint.getStatusCode().value());
        assertEquals("CONSTRAINT_VIOLATION", constraint.getBody().getProperties().get("code"));
        var password = handler.passwordPolicy(new PasswordPolicyException("The password is invalid."));
        assertEquals(400, password.getStatusCode().value());
        assertEquals("The password is invalid.", ((Map<?, ?>)((java.util.List<?>)password.getBody().getProperties().get("fieldErrors")).getFirst()).get("message"));
    }

    @Test void mapsNewWorkspaceAndProjectErrors() {
        var notFound = handler.notFound(new ResourceNotFoundException("PROJECT_NOT_FOUND", "Brak projektu."));
        assertEquals(404, notFound.getStatusCode().value());
        assertEquals("PROJECT_NOT_FOUND", notFound.getBody().getProperties().get("code"));
        assertEquals("Brak projektu.", notFound.getBody().getDetail());

        var forbidden = handler.forbidden(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));
        assertEquals(403, forbidden.getStatusCode().value());
        assertEquals("WORKSPACE_FORBIDDEN", forbidden.getBody().getProperties().get("code"));

        var limit = handler.limitReached(new LimitReachedException("PROJECT_LIMIT_REACHED", "Limit."));
        assertEquals(409, limit.getStatusCode().value());
        assertEquals("PROJECT_LIMIT_REACHED", limit.getBody().getProperties().get("code"));

        var invalid = handler.invalidRequest(new InvalidRequestException("INVALID_TONE", "Zły kolor."));
        assertEquals(400, invalid.getStatusCode().value());
        assertEquals("INVALID_TONE", invalid.getBody().getProperties().get("code"));

        var conflict = handler.conflict(new ConflictException("ASSET_IN_USE", "Obraz jest używany."));
        assertEquals(409, conflict.getStatusCode().value());
        assertEquals("ASSET_IN_USE", conflict.getBody().getProperties().get("code"));
        assertEquals("Obraz jest używany.", conflict.getBody().getDetail());
    }

    @Test void mapsMultipartSizeLimitToAssetTooLarge() {
        var response = handler.uploadTooLarge();
        assertEquals(413, response.getStatusCode().value());
        assertEquals("ASSET_TOO_LARGE", response.getBody().getProperties().get("code"));
        assertEquals("Plik może mieć maksymalnie 10 MB.", response.getBody().getDetail());

        var serviceResponse = handler.invalidRequest(
                new InvalidRequestException("ASSET_TOO_LARGE", "Plik może mieć maksymalnie 10 MB."));
        assertEquals(413, serviceResponse.getStatusCode().value());
        assertEquals("ASSET_TOO_LARGE", serviceResponse.getBody().getProperties().get("code"));

        var avatarResponse = handler.invalidRequest(
                new InvalidRequestException("AVATAR_TOO_LARGE", "Avatar może mieć maksymalnie 5 MB."));
        assertEquals(413, avatarResponse.getStatusCode().value());
        assertEquals("AVATAR_TOO_LARGE", avatarResponse.getBody().getProperties().get("code"));
    }

    @Test void mapsVerificationAndRateLimitErrors() {
        assertEquals(403, handler.emailNotVerified().getStatusCode().value());

        var resend = handler.verificationError(new VerificationException("OTP_RESEND_WAIT", 30));
        assertEquals(429, resend.getStatusCode().value());
        assertEquals("30", resend.getHeaders().getFirst("Retry-After"));
        assertEquals(30L, resend.getBody().getProperties().get("retryAfterSeconds"));

        var invalid = handler.verificationError(new VerificationException("OTP_INVALID", 0));
        assertEquals(400, invalid.getStatusCode().value());
        assertNull(invalid.getHeaders().getFirst("Retry-After"));

        var limited = handler.loginRateLimited(new LoginRateLimitException(45));
        assertEquals(429, limited.getStatusCode().value());
        assertEquals("45", limited.getHeaders().getFirst("Retry-After"));
    }
}
