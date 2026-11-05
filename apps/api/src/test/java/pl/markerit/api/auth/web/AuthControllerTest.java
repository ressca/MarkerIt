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
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.session.AuthSessionService.LoginSession;
import pl.markerit.api.security.SecurityConfiguration;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

class AuthControllerTest {
    private UserService users;
    private AuthSessionService sessions;
    private LoginRateLimiter loginRateLimiter;
    private AuthController controller;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        sessions = mock(AuthSessionService.class);
        loginRateLimiter = mock(LoginRateLimiter.class);
        when(loginRateLimiter.allow(anyString(), anyString(), any())).thenReturn(true);
        controller = new AuthController(users, sessions, loginRateLimiter, false, Duration.ofHours(12));
    }

    @Test void returnsCsrfToken() {
        var token = new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "csrf-value");
        assertEquals("csrf-value", controller.csrfToken(token).token());
    }

    @Test void registersAndReturnsPublicUserDetails() {
        UUID id = UUID.randomUUID();
        Instant createdAt = Instant.now();
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        when(user.getEmail()).thenReturn("person@example.com");
        when(user.getCreatedAt()).thenReturn(createdAt);
        when(users.createUser("person@example.com", "password-1234")).thenReturn(user);
        var response = controller.register(new RegisterRequest("person@example.com", "password-1234"));
        assertEquals(id, response.id());
        assertEquals("person@example.com", response.email());
        assertEquals(createdAt, response.createdAt());
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
