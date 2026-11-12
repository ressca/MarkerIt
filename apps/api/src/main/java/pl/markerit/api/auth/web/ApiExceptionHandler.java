package pl.markerit.api.auth.web;

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
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.EmailNotVerifiedException;
import pl.markerit.api.auth.PasswordPolicyException;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "The submitted data is invalid.");
        List<Map<String, String>> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "code", error.getCode() == null ? "invalid" : error.getCode(),
                        "message", error.getDefaultMessage() == null ? "Check this field." : error.getDefaultMessage()))
                .toList();
        problem.setProperty("fieldErrors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ProblemDetail> invalidCredentials() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(problem(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "The email or password is incorrect."));
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    ResponseEntity<ProblemDetail> emailNotVerified() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(problem(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Verify your email address before signing in."));
    }

    @ExceptionHandler(VerificationException.class)
    ResponseEntity<ProblemDetail> verificationError(VerificationException exception) {
        HttpStatus status = exception.getCode().contains("LIMIT") || exception.getCode().contains("WAIT")
                ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_REQUEST;
        ProblemDetail body = problem(status, exception.getCode(), verificationMessage(exception.getCode()));
        if (exception.getRetryAfterSeconds() > 0) body.setProperty("retryAfterSeconds", exception.getRetryAfterSeconds());
        ResponseEntity.BodyBuilder response = ResponseEntity.status(status);
        if (exception.getRetryAfterSeconds() > 0) response.header("Retry-After", Long.toString(exception.getRetryAfterSeconds()));
        return response.body(body);
    }

    private String verificationMessage(String code) {
        return switch (code) {
            case "OTP_RESEND_WAIT" -> "Wait before requesting another code.";
            case "OTP_RESEND_LIMIT" -> "Too many codes requested. Try again later.";
            case "OTP_VERIFY_LIMIT" -> "Too many incorrect codes. Request a new code.";
            case "OTP_EXPIRED" -> "This code has expired. Request a new one.";
            default -> "The verification code is invalid.";
        };
    }

    @ExceptionHandler(LoginRateLimitException.class)
    ResponseEntity<ProblemDetail> loginRateLimited(LoginRateLimitException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", Long.toString(exception.getRetryAfterSeconds()))
                .body(problem(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED", "Too many login attempts. Try again later."));
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    ResponseEntity<ProblemDetail> duplicateEmail() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists."));
    }

    @ExceptionHandler(PasswordPolicyException.class)
    ResponseEntity<ProblemDetail> passwordPolicy(PasswordPolicyException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "The password is invalid.");
        problem.setProperty("fieldErrors", List.of(Map.of(
                "field", "password", "code", "password_length", "message", exception.getMessage())));
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(problem(HttpStatus.NOT_FOUND, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(ForbiddenAccessException.class)
    ResponseEntity<ProblemDetail> forbidden(ForbiddenAccessException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(problem(HttpStatus.FORBIDDEN, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(LimitReachedException.class)
    ResponseEntity<ProblemDetail> limitReached(LimitReachedException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    ResponseEntity<ProblemDetail> invalidRequest(InvalidRequestException exception) {
        HttpStatus status = "ASSET_TOO_LARGE".equals(exception.getCode())
                        || "AVATAR_TOO_LARGE".equals(exception.getCode())
                ? HttpStatus.CONTENT_TOO_LARGE
                : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status)
                .body(problem(status, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ProblemDetail> conflict(ConflictException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> uploadTooLarge() {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
                .body(problem(HttpStatus.CONTENT_TOO_LARGE, "ASSET_TOO_LARGE", "Plik może mieć maksymalnie 10 MB."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> constraintViolation() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(problem(HttpStatus.CONFLICT, "CONSTRAINT_VIOLATION", "The operation conflicts with existing data."));
    }

    private ProblemDetail problem(HttpStatus status, String code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("https://markerit.app/problems/" + code.toLowerCase(java.util.Locale.ROOT)));
        problem.setTitle(code);
        problem.setProperty("code", code);
        return problem;
    }
}
