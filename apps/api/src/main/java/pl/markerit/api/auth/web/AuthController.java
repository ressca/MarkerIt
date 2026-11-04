package pl.markerit.api.auth.web;

import jakarta.validation.Valid;
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
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService users;
    private final AuthSessionService sessions;
    private final boolean secureCookie;
    private final Duration tokenLifetime;

    public AuthController(
            UserService users,
            AuthSessionService sessions,
            @Value("${app.security.auth-cookie-secure:false}") boolean secureCookie,
            @Value("${app.security.jwt-lifetime:PT12H}") Duration tokenLifetime) {
        this.users = users;
        this.sessions = sessions;
        this.secureCookie = secureCookie;
        this.tokenLifetime = tokenLifetime;
    }

    @GetMapping("/csrf")
    public CsrfTokenResponse csrfToken(CsrfToken csrfToken) {
        return new CsrfTokenResponse(csrfToken.getToken());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisteredUser register(@Valid @RequestBody RegisterRequest request) {
        User user = users.createUser(request.email(), request.password());
        return new RegisteredUser(user.getId(), user.getEmail(), user.getCreatedAt());
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthSessionService.LoginSession session = sessions.login(request.email(), request.password());
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

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal Jwt jwt) {
        sessions.revoke(UUID.fromString(jwt.getId()));
        ResponseCookie expiredCookie = ResponseCookie.from(SecurityConfiguration.SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expiredCookie.toString()).build();
    }

    public record RegisteredUser(UUID id, String email, Instant createdAt) {
    }

    public record LoginResponse(UUID id, String email, Instant expiresAt) {
    }

    public record CsrfTokenResponse(String token) {
    }
}
