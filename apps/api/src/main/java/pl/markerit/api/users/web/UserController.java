package pl.markerit.api.users.web;

import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.verification.EmailChangeService;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.auth.web.LoginRateLimitException;
import pl.markerit.api.auth.web.LoginRateLimiter;
import pl.markerit.api.common.CurrentUser;
import pl.markerit.api.realtime.RealtimeSessionRegistry;
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.ProfileService;
import pl.markerit.api.users.User;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final ProfileService profiles;
    private final EmailChangeService emailChanges;
    private final AuthSessionService sessions;
    private final LoginRateLimiter rateLimiter;
    private final RealtimeSessionRegistry realtimeSessions;
    private final boolean secureCookie;

    public UserController(
            ProfileService profiles,
            EmailChangeService emailChanges,
            AuthSessionService sessions,
            LoginRateLimiter rateLimiter,
            RealtimeSessionRegistry realtimeSessions,
            @Value("${app.security.auth-cookie-secure:false}") boolean secureCookie) {
        this.profiles = profiles;
        this.emailChanges = emailChanges;
        this.sessions = sessions;
        this.rateLimiter = rateLimiter;
        this.realtimeSessions = realtimeSessions;
        this.secureCookie = secureCookie;
    }

    @GetMapping("/me")
    public UserProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return profiles.getProfile(CurrentUser.id(jwt));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest request) {
        User user = profiles.updateProfile(CurrentUser.id(jwt), request);
        return withRefreshedSession(jwt, user);
    }

    @PostMapping(path = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> uploadAvatar(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("file") MultipartFile file) {
        User user = profiles.updateAvatar(CurrentUser.id(jwt), file);
        return withRefreshedSession(jwt, user);
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<UserProfileResponse> deleteAvatar(@AuthenticationPrincipal Jwt jwt) {
        User user = profiles.removeAvatar(CurrentUser.id(jwt));
        return withRefreshedSession(jwt, user);
    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest) {
        UUID userId = CurrentUser.id(jwt);
        enforceSensitiveActionRateLimit(httpRequest, userId);
        var revoked = profiles.changePassword(
                userId,
                UUID.fromString(jwt.getId()),
                request.currentPassword(),
                request.newPassword());
        // Database sessions are revoked inside the password transaction; the
        // already-open STOMP connections need to be closed separately.
        for (UUID sessionId : revoked) {
            realtimeSessions.closeAuthSession(sessionId.toString());
        }
    }

    @PostMapping("/me/email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public EmailChangeChallengeResponse requestEmailChange(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChangeEmailRequest request,
            HttpServletRequest httpRequest) {
        UUID userId = CurrentUser.id(jwt);
        enforceSensitiveActionRateLimit(httpRequest, userId);
        var delivery = emailChanges.request(
                userId,
                request.newEmail(),
                request.currentPassword(),
                isPolish(httpRequest));
        return new EmailChangeChallengeResponse(
                delivery.email(), delivery.resendAvailableAt(), delivery.expiresAt());
    }

    @PostMapping("/me/email/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public EmailChangeChallengeResponse resendEmailChange(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        var delivery = emailChanges.resend(CurrentUser.id(jwt), isPolish(httpRequest));
        return new EmailChangeChallengeResponse(
                delivery.email(), delivery.resendAvailableAt(), delivery.expiresAt());
    }

    @PostMapping("/me/email/verify")
    public ResponseEntity<UserProfileResponse> verifyEmailChange(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody VerifyEmailChangeRequest request) {
        var result = emailChanges.verify(
                CurrentUser.id(jwt), request.newEmail(), request.code());
        if (result != EmailChangeService.VerificationResult.VERIFIED) {
            String errorCode = switch (result) {
                case EXPIRED -> "OTP_EXPIRED";
                case LIMIT_REACHED -> "OTP_VERIFY_LIMIT";
                default -> "OTP_INVALID";
            };
            throw new VerificationException(
                    errorCode,
                    result == EmailChangeService.VerificationResult.LIMIT_REACHED ? 60 : 0);
        }
        User user = profiles.requireUser(CurrentUser.id(jwt));
        return withRefreshedSession(jwt, user);
    }

    private ResponseEntity<UserProfileResponse> withRefreshedSession(Jwt jwt, User user) {
        AuthSessionService.RefreshedToken refreshed;
        try {
            refreshed = sessions.refresh(UUID.fromString(jwt.getId()), user);
        } catch (InvalidCredentialsException exception) {
            // The profile mutation already committed. Let the client keep the
            // new profile; the next request will require a fresh login.
            return ResponseEntity.ok(profiles.toResponse(user));
        }
        Duration maxAge = Duration.between(Instant.now(), refreshed.expiresAt());
        ResponseCookie cookie = ResponseCookie
                .from(SecurityConfiguration.SESSION_COOKIE, refreshed.token())
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(profiles.toResponse(user));
    }

    private void enforceSensitiveActionRateLimit(HttpServletRequest request, UUID userId) {
        Instant now = Instant.now();
        String key = "settings:" + userId;
        if (!rateLimiter.allow(request.getRemoteAddr(), key, now)) {
            throw new LoginRateLimitException(
                    rateLimiter.retryAfterSeconds(request.getRemoteAddr(), key, now));
        }
    }

    private boolean isPolish(HttpServletRequest request) {
        return "pl".equalsIgnoreCase(request.getLocale().getLanguage());
    }
}
