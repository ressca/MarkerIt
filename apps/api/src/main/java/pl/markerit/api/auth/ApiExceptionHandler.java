package pl.markerit.api.auth;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Dane formularza są nieprawidłowe.");
        List<Map<String, String>> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "code", error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage(),
                        "message", "Sprawdź to pole."))
                .toList();
        problem.setProperty("fieldErrors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    ResponseEntity<ProblemDetail> duplicateEmail() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED", "Konto z tym adresem e-mail już istnieje."));
    }

    @ExceptionHandler(PasswordPolicyException.class)
    ResponseEntity<ProblemDetail> passwordPolicy(PasswordPolicyException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Hasło jest nieprawidłowe.");
        problem.setProperty("fieldErrors", List.of(Map.of(
                "field", "password", "code", "password_length", "message", exception.getMessage())));
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> constraintViolation() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED", "Konto z tym adresem e-mail już istnieje."));
    }

    private ProblemDetail problem(HttpStatus status, String code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("https://markerit.app/problems/" + code.toLowerCase(java.util.Locale.ROOT)));
        problem.setTitle(code);
        problem.setProperty("code", code);
        return problem;
    }
}
