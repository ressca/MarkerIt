package pl.markerit.api.auth.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.mock.web.MockHttpServletRequest;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.session.AuthSessionService.LoginSession;
import pl.markerit.api.auth.verification.EmailVerificationService;
import pl.markerit.api.auth.verification.VerificationException;
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

class AuthControllerTest {
    private UserService users;
    private AuthSessionService sessions;
    private LoginRateLimiter loginRateLimiter;
    private EmailVerificationService emailVerification;
    private AuthController controller;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        sessions = mock(AuthSessionService.class);
        loginRateLimiter = mock(LoginRateLimiter.class);
        emailVerification = mock(EmailVerificationService.class);
        when(loginRateLimiter.allow(anyString(), anyString(), any())).thenReturn(true);
        controller = new AuthController(users, sessions, loginRateLimiter, emailVerification, false, Duration.ofHours(12));
    }

    @Test void returnsCsrfToken() {
        var token = new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "csrf-value");
        assertEquals("csrf-value", controller.csrfToken(token).token());
    }

    @Test void registersAndRequestsEmailVerification() {
        User user = mock(User.class);
        when(user.getEmail()).thenReturn("person@example.com");
        when(users.createUser("person@example.com", "password-1234")).thenReturn(user);
        Instant expires = Instant.now().plusSeconds(600);
        Instant resendAt = Instant.now().plusSeconds(60);
        when(emailVerification.requestCode("person@example.com", false))
                .thenReturn(new EmailVerificationService.Delivery(resendAt, expires));
        var response = controller.register(new RegisterRequest("person@example.com", "password-1234"), new MockHttpServletRequest());
        assertEquals(202, response.getStatusCode().value());
        assertEquals("person@example.com", response.getBody().email());
        assertEquals(resendAt, response.getBody().resendAvailableAt());
    }

    @Test void loginSetsHttpOnlyStrictCookie() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(UUID.randomUUID());
        when(user.getEmail()).thenReturn("person@example.com");
        Instant expires = Instant.now().plusSeconds(3600);
        when(sessions.login("person@example.com", "password-1234"))
                .thenReturn(new LoginSession("jwt-value", expires, user));
        var response = controller.login(new LoginRequest("person@example.com", "password-1234"),
                new org.springframework.mock.web.MockHttpServletRequest());
        assertEquals("person@example.com", response.getBody().email());
        String cookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertNotNull(cookie);
        assertTrue(cookie.contains(SecurityConfiguration.SESSION_COOKIE + "=jwt-value"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Strict"));
        assertTrue(cookie.contains("Max-Age=43200"));
    }

    @Test void resendVerificationReturnsCooldownAndExpiry() {
        Instant expires = Instant.now().plusSeconds(600);
        Instant resendAt = Instant.now().plusSeconds(60);
        when(emailVerification.requestCode("person@example.com", false))
                .thenReturn(new EmailVerificationService.Delivery(resendAt, expires));
        var response = controller.resendVerification(new AuthController.EmailRequest("person@example.com"),
                new MockHttpServletRequest());
        assertEquals(202, response.getStatusCode().value());
        assertEquals(resendAt, response.getBody().resendAvailableAt());
        assertEquals(expires, response.getBody().expiresAt());
    }

    @Test void verifiesOtpAndStartsSession() {
        UUID id = UUID.randomUUID();
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        when(user.getEmail()).thenReturn("person@example.com");
        when(emailVerification.verify("person@example.com", "012345"))
                .thenReturn(EmailVerificationService.VerificationResult.VERIFIED);
        when(users.findByEmail("person@example.com")).thenReturn(java.util.Optional.of(user));
        when(sessions.loginVerifiedUser(id)).thenReturn(new LoginSession("verified-jwt", Instant.now().plusSeconds(3600), user));

        var response = controller.verifyEmail(new AuthController.VerifyEmailRequest("person@example.com", "012345"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("person@example.com", response.getBody().email());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE).contains("markerit_session=verified-jwt"));
    }

    @Test void returnsVerificationErrorForInvalidOtp() {
        when(emailVerification.verify("person@example.com", "000000"))
                .thenReturn(EmailVerificationService.VerificationResult.INVALID);
        assertThrows(VerificationException.class, () -> controller.verifyEmail(
                new AuthController.VerifyEmailRequest("person@example.com", "000000")));
    }

    @Test void validatesSessionWithoutChangingResponse() {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject("user").build();
        assertDoesNotThrow(() -> controller.validateSession(jwt));
    }

    @Test void logoutRevokesSessionAndClearsCookie() {
        UUID sessionId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "HS256").claim("jti", sessionId.toString()).build();
        var response = controller.logout(jwt);
        verify(sessions).revoke(sessionId);
        assertEquals(204, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE).contains("Max-Age=0"));
    }
}
