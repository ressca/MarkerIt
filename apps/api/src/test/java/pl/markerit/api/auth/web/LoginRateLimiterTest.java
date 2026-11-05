package pl.markerit.api.auth.web;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {
    @Test void enforcesLimitByIpAndAccountUntilWindowExpires() {
        LoginRateLimiter limiter = new LoginRateLimiter(2, Duration.ofMinutes(15));
        Instant start = Instant.parse("2026-11-05T10:00:00Z");

        assertTrue(limiter.allow("192.0.2.1", "Person@example.com", start));
        assertTrue(limiter.allow("192.0.2.1", "person@example.com", start.plusSeconds(1)));
        assertFalse(limiter.allow("192.0.2.1", "another@example.com", start.plusSeconds(2)));
        assertFalse(limiter.allow("192.0.2.2", "PERSON@example.com", start.plusSeconds(2)));
        assertTrue(limiter.allow("192.0.2.1", "another@example.com", start.plus(Duration.ofMinutes(16))));
    }

    @Test void rejectsInvalidConfiguration() {
        assertThrows(IllegalArgumentException.class, () -> new LoginRateLimiter(0, Duration.ofMinutes(1)));
        assertThrows(IllegalArgumentException.class, () -> new LoginRateLimiter(1, Duration.ZERO));
    }
}
