package pl.markerit.api.auth;

import java.time.Instant;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
        Instant issuedAt = Instant.now();
        UserSession session = sessions.save(new UserSession(UUID.randomUUID(), user, issuedAt.plus(tokenLifetime)));
        String token = jwtTokens.create(user, session, issuedAt);
        return new LoginSession(token, session.getExpiresAt(), user);
    }

    @Transactional(readOnly = true)
    public boolean isActive(UUID sessionId, Instant now) {
        return sessions.existsByIdAndRevokedAtIsNullAndExpiresAtAfter(sessionId, now);
    }

    public record LoginSession(String token, Instant expiresAt, User user) {
    }
}
