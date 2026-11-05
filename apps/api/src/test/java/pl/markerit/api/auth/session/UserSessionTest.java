package pl.markerit.api.auth.session;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import pl.markerit.api.users.User;

class UserSessionTest {
    @Test void storesSessionDetailsAndCanBeRevoked() {
        User user = mock(User.class);
        Instant expires = Instant.now().plusSeconds(600);
        UserSession session = new UserSession(UUID.randomUUID(), user, expires);
        assertSame(user, session.getUser());
        assertEquals(expires, session.getExpiresAt());
        assertNull(session.getRevokedAt());
        Instant revoked = Instant.now();
        session.revoke(revoked);
        assertEquals(revoked, session.getRevokedAt());
    }
}
