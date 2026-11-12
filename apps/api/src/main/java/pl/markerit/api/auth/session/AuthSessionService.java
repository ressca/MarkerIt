package pl.markerit.api.auth.session;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.auth.InvalidCredentialsException;
import pl.markerit.api.auth.EmailNotVerifiedException;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

@Service
public class AuthSessionService {

    private final UserService users;
    private final UserSessionRepository sessions;
    private final JwtTokenService jwtTokens;
    private final Duration tokenLifetime;

    public AuthSessionService(
            UserService users,
            UserSessionRepository sessions,
            JwtTokenService jwtTokens,
            @Value("${app.security.jwt-lifetime:PT12H}") Duration tokenLifetime) {
        this.users = users;
        this.sessions = sessions;
        this.jwtTokens = jwtTokens;
        this.tokenLifetime = tokenLifetime;
    }

    @Transactional
    public LoginSession login(String email, String password) {
        User user = users.authenticate(email, password).orElseThrow(InvalidCredentialsException::new);
        if (!user.isEmailVerified()) throw new EmailNotVerifiedException();
        return createSession(user);
    }

    @Transactional
    public LoginSession loginVerifiedUser(java.util.UUID userId) {
        User user = users.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!user.isEmailVerified()) throw new EmailNotVerifiedException();
        return createSession(user);
    }

    private LoginSession createSession(User user) {
        Instant issuedAt = Instant.now();
        UserSession session = sessions.save(new UserSession(UUID.randomUUID(), user, issuedAt.plus(tokenLifetime)));
        String token = jwtTokens.create(user, session, issuedAt);
        return new LoginSession(token, session.getExpiresAt(), user);
    }

    @Transactional
    public void revoke(UUID sessionId) {
        sessions.findById(sessionId).ifPresent(session -> {
            session.revoke(Instant.now());
            sessions.save(session);
        });
    }

    /**
     * Re-issues the JWT for an existing active session, so profile claims such
     * as display name, email and avatar stay in sync with the database.
     */
    @Transactional(readOnly = true)
    public RefreshedToken refresh(UUID sessionId, User user) {
        UserSession session = sessions.findById(sessionId)
                .filter(candidate -> candidate.getRevokedAt() == null)
                .filter(candidate -> candidate.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(InvalidCredentialsException::new);
        return new RefreshedToken(
                jwtTokens.create(user, session, Instant.now()),
                session.getExpiresAt());
    }

    @Transactional
    public void revokeOtherSessions(UUID userId, UUID currentSessionId) {
        Instant now = Instant.now();
        for (UserSession session : sessions.findByUser_IdAndRevokedAtIsNull(userId)) {
            if (!session.getId().equals(currentSessionId)) {
                session.revoke(now);
                sessions.save(session);
            }
        }
    }

    @Transactional(readOnly = true)
    public boolean isActive(UUID sessionId, Instant now) {
        return sessions.existsByIdAndRevokedAtIsNullAndExpiresAtAfter(sessionId, now);
    }

    public record LoginSession(String token, Instant expiresAt, User user) {
    }

    public record RefreshedToken(String token, Instant expiresAt) {
    }
}
