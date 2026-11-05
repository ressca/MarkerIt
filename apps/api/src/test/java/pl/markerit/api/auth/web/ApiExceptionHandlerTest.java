package pl.markerit.api.auth.web;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.PropertyAccessorFactory;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.PasswordPolicyException;

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
        assertEquals(409, handler.constraintViolation().getStatusCode().value());
        var password = handler.passwordPolicy(new PasswordPolicyException("The password is invalid."));
        assertEquals(400, password.getStatusCode().value());
        assertEquals("The password is invalid.", ((Map<?, ?>)((java.util.List<?>)password.getBody().getProperties().get("fieldErrors")).getFirst()).get("message"));
    }
}
