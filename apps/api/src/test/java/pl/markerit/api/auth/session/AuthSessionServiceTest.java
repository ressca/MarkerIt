package pl.markerit.api.auth.session;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

class AuthSessionServiceTest {
    private UserService users;
    private UserSessionRepository sessions;
    private JwtTokenService tokens;
    private AuthSessionService service;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        sessions = mock(UserSessionRepository.class);
        tokens = mock(JwtTokenService.class);
        service = new AuthSessionService(users, sessions, tokens, Duration.ofHours(12));
    }

    @Test void loginCreatesPersistedSessionAndJwt() {
        User user = mock(User.class);
        when(users.authenticate("user@example.com", "password")).thenReturn(Optional.of(user));
        when(sessions.save(any(UserSession.class))).thenAnswer(call -> call.getArgument(0));
        when(tokens.create(eq(user), any(UserSession.class), any(Instant.class))).thenReturn("signed-token");

        AuthSessionService.LoginSession result = service.login("user@example.com", "password");

        assertEquals("signed-token", result.token());
        Duration remaining = Duration.between(Instant.now(), result.expiresAt());
        assertTrue(remaining.compareTo(Duration.ofHours(12)) <= 0);
        assertTrue(remaining.compareTo(Duration.ofHours(12).minusSeconds(1)) > 0);
        assertSame(user, result.user());
        verify(sessions).save(any(UserSession.class));
        verify(tokens).create(eq(user), any(UserSession.class), any(Instant.class));
    }

    @Test void loginRejectsInvalidCredentials() {
        when(users.authenticate("user@example.com", "wrong")).thenReturn(Optional.empty());
        assertThrows(InvalidCredentialsException.class, () -> service.login("user@example.com", "wrong"));
        verifyNoInteractions(sessions, tokens);
    }

    @Test void revokePersistsRevokedSessionAndIgnoresUnknownId() {
        UUID id = UUID.randomUUID();
        UserSession session = mock(UserSession.class);
        when(sessions.findById(id)).thenReturn(Optional.of(session));
        service.revoke(id);
        verify(session).revoke(any(Instant.class));
        verify(sessions).save(session);
        when(sessions.findById(any())).thenReturn(Optional.empty());
        service.revoke(UUID.randomUUID());
    }

    @Test void checksSessionActiveAtProvidedInstant() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        when(sessions.existsByIdAndRevokedAtIsNullAndExpiresAtAfter(id, now)).thenReturn(true);
        assertTrue(service.isActive(id, now));
    }
}
