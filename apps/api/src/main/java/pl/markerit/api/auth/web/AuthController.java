package pl.markerit.api.auth.web;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.verification.EmailVerificationService;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.realtime.RealtimeSessionRegistry;
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService users;
    private final AuthSessionService sessions;
    private final LoginRateLimiter loginRateLimiter;
    private final EmailVerificationService emailVerification;
    private final RealtimeSessionRegistry realtimeSessions;
    private final boolean secureCookie;
    private final Duration tokenLifetime;

    public AuthController(
            UserService users,
            AuthSessionService sessions,
            LoginRateLimiter loginRateLimiter,
            EmailVerificationService emailVerification,
            RealtimeSessionRegistry realtimeSessions,
            @Value("${app.security.auth-cookie-secure:false}") boolean secureCookie,
            @Value("${app.security.jwt-lifetime:PT12H}") Duration tokenLifetime) {
        this.users = users;
        this.sessions = sessions;
        this.loginRateLimiter = loginRateLimiter;
        this.emailVerification = emailVerification;
        this.realtimeSessions = realtimeSessions;
        this.secureCookie = secureCookie;
        this.tokenLifetime = tokenLifetime;
    }

    @GetMapping("/csrf")
    public CsrfTokenResponse csrfToken(CsrfToken csrfToken) {
        return new CsrfTokenResponse(csrfToken.getToken());
    }

    @PostMapping("/register")
    public ResponseEntity<RegistrationResponse> register(@Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest) {
        enforceVerificationRateLimit(request.email(), httpRequest);
        User user;
        try {
            user = users.createUser(request.email(), request.password());
        } catch (EmailAlreadyRegisteredException alreadyRegistered) {
            user = users.findByEmail(request.email()).orElseThrow(() -> alreadyRegistered);
            if (user.isEmailVerified()) throw alreadyRegistered;
        }
        var delivery = emailVerification.requestCode(user.getEmail(), isPolish(httpRequest));
        return ResponseEntity.accepted().body(new RegistrationResponse(user.getEmail(), delivery.expiresAt(), delivery.resendAvailableAt()));
    }

    @PostMapping("/verification/resend")
    public ResponseEntity<RegistrationResponse> resendVerification(@Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest) {
        enforceVerificationRateLimit(request.email(), httpRequest);
        var delivery = emailVerification.requestCode(request.email(), isPolish(httpRequest));
        return ResponseEntity.accepted().body(new RegistrationResponse(request.email(), delivery.expiresAt(), delivery.resendAvailableAt()));
    }

    @PostMapping("/verification/verify")
    public ResponseEntity<LoginResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        var result = emailVerification.verify(request.email(), request.code());
        if (result != EmailVerificationService.VerificationResult.VERIFIED) {
            String errorCode = switch (result) {
                case EXPIRED -> "OTP_EXPIRED";
                case LIMIT_REACHED -> "OTP_VERIFY_LIMIT";
                default -> "OTP_INVALID";
            };
            throw new VerificationException(errorCode, result == EmailVerificationService.VerificationResult.LIMIT_REACHED ? 60 : 0);
        }
        return sessionResponse(sessions.loginVerifiedUser(users.findByEmail(request.email()).orElseThrow().getId()));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        if (!loginRateLimiter.allow(httpRequest.getRemoteAddr(), request.email(), Instant.now())) {
            throw new LoginRateLimitException(loginRateLimiter.retryAfterSeconds(
                    httpRequest.getRemoteAddr(), request.email(), Instant.now()));
        }
        AuthSessionService.LoginSession session = sessions.login(request.email(), request.password());
        return sessionResponse(session);
    }

    private ResponseEntity<LoginResponse> sessionResponse(AuthSessionService.LoginSession session) {
        ResponseCookie cookie = ResponseCookie.from(SecurityConfiguration.SESSION_COOKIE, session.token())
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(tokenLifetime)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new LoginResponse(session.user().getId(), session.user().getEmail(), session.expiresAt()));
    }

    private boolean isPolish(HttpServletRequest request) {
        return "pl".equalsIgnoreCase(request.getLocale().getLanguage());
    }

    private void enforceVerificationRateLimit(String email, HttpServletRequest request) {
        String address = request.getRemoteAddr();
        Instant now = Instant.now();
        if (!loginRateLimiter.allow(address, email, now)) {
            throw new VerificationException("OTP_RESEND_LIMIT", loginRateLimiter.retryAfterSeconds(address, email, now));
        }
    }

    @GetMapping("/session")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void validateSession(@AuthenticationPrincipal Jwt jwt) {
        // The resource server validates the token signature and active database session.
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal Jwt jwt) {
        UUID sessionId = UUID.fromString(jwt.getId());
        sessions.revoke(sessionId);
        // Close only this device's STOMP connection; other sessions for the
        // same user stay signed in.
        realtimeSessions.closeAuthSession(sessionId.toString());
        ResponseCookie expiredCookie = ResponseCookie.from(SecurityConfiguration.SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expiredCookie.toString()).build();
    }

    public record RegistrationResponse(String email, Instant expiresAt, Instant resendAvailableAt) {
    }

    public record EmailRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email String email) {}
    public record VerifyEmailRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Email String email,
            @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{6}$") String code) {}

    public record LoginResponse(UUID id, String email, Instant expiresAt) {
    }

    public record CsrfTokenResponse(String token) {
    }
}
