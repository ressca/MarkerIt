package pl.markerit.api.users.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.verification.EmailChangeService;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.auth.web.LoginRateLimitException;
import pl.markerit.api.auth.web.LoginRateLimiter;
import pl.markerit.api.realtime.RealtimeSessionRegistry;
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.ProfileService;
import pl.markerit.api.users.User;

class UserControllerTest {

    private ProfileService profiles;
    private EmailChangeService emailChanges;
    private AuthSessionService sessions;
    private LoginRateLimiter rateLimiter;
    private RealtimeSessionRegistry realtimeSessions;
    private UserController controller;
    private UUID userId;
    private UUID sessionId;
    private Jwt jwt;
    private User user;

    @BeforeEach void setUp() {
        profiles = mock(ProfileService.class);
        emailChanges = mock(EmailChangeService.class);
        sessions = mock(AuthSessionService.class);
        rateLimiter = mock(LoginRateLimiter.class);
        realtimeSessions = mock(RealtimeSessionRegistry.class);
        when(rateLimiter.allow(any(), anyString(), any())).thenReturn(true);
        controller = new UserController(
                profiles, emailChanges, sessions, rateLimiter, realtimeSessions, false);
        userId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("jti", sessionId.toString())
                .build();
        user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(user.getEmail()).thenReturn("anna@example.com");
        when(user.getDisplayName()).thenReturn("Anna Kowalska");
        when(user.getLocale()).thenReturn("pl");
        when(profiles.requireUser(userId)).thenReturn(user);
        when(profiles.toResponse(user)).thenReturn(profile());
        when(sessions.refresh(eq(sessionId), eq(user))).thenReturn(
                new AuthSessionService.RefreshedToken("refreshed", Instant.now().plusSeconds(3600)));
    }

    @Test void returnsCurrentProfile() {
        when(profiles.getProfile(userId)).thenReturn(profile());

        var response = controller.me(jwt);

        assertEquals("anna@example.com", response.email());
        assertEquals("AK", response.initials());
    }

    @Test void updatesProfileAndRefreshesTheSessionCookie() {
        when(profiles.updateProfile(eq(userId), any())).thenReturn(user);
        var request = new UpdateProfileRequest("Anna Nowak", "en");

        var response = controller.update(jwt, request);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Anna Kowalska", response.getBody().displayName());
        assertCookie(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE));
        verify(sessions).refresh(sessionId, user);
    }

    @Test void returnsTheUpdatedProfileWhenTheSessionExpiresDuringRefresh() {
        when(profiles.updateProfile(eq(userId), any())).thenReturn(user);
        when(sessions.refresh(eq(sessionId), eq(user)))
                .thenThrow(new InvalidCredentialsException());

        var response = controller.update(jwt, new UpdateProfileRequest("Anna Nowak", null));

        assertEquals(200, response.getStatusCode().value());
        assertNull(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE));
        assertEquals("Anna Kowalska", response.getBody().displayName());
    }

    @Test void uploadsAndDeletesAvatar() {
        when(profiles.updateAvatar(eq(userId), any())).thenReturn(user);
        when(profiles.removeAvatar(userId)).thenReturn(user);

        var uploaded = controller.uploadAvatar(jwt, null);
        var removed = controller.deleteAvatar(jwt);

        assertEquals(200, uploaded.getStatusCode().value());
        assertEquals(200, removed.getStatusCode().value());
        verify(profiles).updateAvatar(eq(userId), any());
        verify(profiles).removeAvatar(userId);
    }

    @Test void changesPasswordAndClosesRevokedRealtimeSessions() {
        UUID otherSession = UUID.randomUUID();
        when(profiles.changePassword(userId, sessionId, "current", "new-password"))
                .thenReturn(java.util.List.of(otherSession));

        controller.changePassword(
                jwt, new ChangePasswordRequest("current", "new-password"), new MockHttpServletRequest());

        verify(profiles).changePassword(userId, sessionId, "current", "new-password");
        verify(realtimeSessions).closeAuthSession(otherSession.toString());
    }

    @Test void rateLimitsPasswordAndEmailChanges() {
        when(rateLimiter.allow(any(), anyString(), any())).thenReturn(false);
        when(rateLimiter.retryAfterSeconds(any(), anyString(), any())).thenReturn(42L);

        assertThrows(LoginRateLimitException.class, () -> controller.changePassword(
                jwt, new ChangePasswordRequest("current", "new-password"), new MockHttpServletRequest()));
        assertThrows(LoginRateLimitException.class, () -> controller.requestEmailChange(
                jwt,
                new ChangeEmailRequest("new@example.com", "current"),
                new MockHttpServletRequest()));
        verify(profiles, never()).changePassword(any(), any(), any(), any());
    }

    @Test void requestsAndResendsEmailChange() {
        Instant resendAt = Instant.now().plusSeconds(60);
        Instant expiresAt = Instant.now().plusSeconds(600);
        when(emailChanges.request(userId, "new@example.com", "current", false))
                .thenReturn(new EmailChangeService.Delivery("new@example.com", resendAt, expiresAt));
        when(emailChanges.resend(userId, false))
                .thenReturn(new EmailChangeService.Delivery("new@example.com", resendAt, expiresAt));

        var requested = controller.requestEmailChange(
                jwt, new ChangeEmailRequest("new@example.com", "current"), new MockHttpServletRequest());
        verify(rateLimiter).allow(any(), eq("settings:" + userId), any());
        var resent = controller.resendEmailChange(jwt, new MockHttpServletRequest());

        assertEquals("new@example.com", requested.email());
        assertEquals(resendAt, requested.resendAvailableAt());
        assertEquals("new@example.com", resent.email());
    }

    @Test void verifiesEmailChangeAndRefreshesTheSession() {
        when(emailChanges.verify(userId, "new@example.com", "012345"))
                .thenReturn(EmailChangeService.VerificationResult.VERIFIED);

        var response = controller.verifyEmailChange(
                jwt, new VerifyEmailChangeRequest("new@example.com", "012345"));

        assertEquals(200, response.getStatusCode().value());
        assertCookie(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE));
        verify(emailChanges).verify(userId, "new@example.com", "012345");
    }

    @Test void mapsEmailChangeVerificationFailures() {
        when(emailChanges.verify(userId, "new@example.com", "000000"))
                .thenReturn(EmailChangeService.VerificationResult.INVALID);
        VerificationException invalid = assertThrows(VerificationException.class,
                () -> controller.verifyEmailChange(
                        jwt, new VerifyEmailChangeRequest("new@example.com", "000000")));
        assertEquals("OTP_INVALID", invalid.getCode());

        when(emailChanges.verify(userId, "new@example.com", "000000"))
                .thenReturn(EmailChangeService.VerificationResult.EXPIRED);
        VerificationException expired = assertThrows(VerificationException.class,
                () -> controller.verifyEmailChange(
                        jwt, new VerifyEmailChangeRequest("new@example.com", "000000")));
        assertEquals("OTP_EXPIRED", expired.getCode());
    }

    private void assertCookie(String cookie) {
        assertNotNull(cookie);
        assertTrue(cookie.contains(SecurityConfiguration.SESSION_COOKIE + "=refreshed"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Strict"));
    }

    private UserProfileResponse profile() {
        return new UserProfileResponse(
                userId,
                "anna@example.com",
                "Anna Kowalska",
                "AK",
                "pl",
                null,
                null,
                Instant.now());
    }
}
