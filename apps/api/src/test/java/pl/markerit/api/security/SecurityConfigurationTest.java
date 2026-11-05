package pl.markerit.api.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import jakarta.servlet.http.Cookie;
import pl.markerit.api.auth.session.AuthSessionService;

class SecurityConfigurationTest {
    private final SecurityConfiguration configuration = new SecurityConfiguration();

    @Test void requiresAtLeast32Utf8SecretBytes() {
        assertThrows(IllegalStateException.class, () -> configuration.jwtSecretKey("short"));
        assertDoesNotThrow(() -> configuration.jwtSecretKey("a-long-enough-secret-with-32-bytes"));
    }

    @Test void resolvesAuthorizationHeaderBeforeSessionCookie() {
        var resolver = configuration.bearerTokenResolver();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(SecurityConfiguration.SESSION_COOKIE, "cookie-token"));
        assertEquals("cookie-token", resolver.resolve(request));
        request.addHeader("Authorization", "Bearer header-token");
        assertEquals("header-token", resolver.resolve(request));
        request.removeHeader("Authorization");
        request.setCookies(new Cookie("other", "ignored"));
        assertNull(resolver.resolve(request));
    }

    @Test void decoderRequiresValidIssuerAndActiveSession() {
        String secret = "markerit-test-secret-with-more-than-32-bytes";
        var key = configuration.jwtSecretKey(secret);
        var encoder = configuration.jwtEncoder(key);
        AuthSessionService sessions = mock(AuthSessionService.class);
        var decoder = configuration.jwtDecoder(key, sessions);
        UUID sessionId = UUID.randomUUID();
        Instant now = Instant.now();

        String token = encode(encoder, now, sessionId.toString(), "markerit-api");
        when(sessions.isActive(eq(sessionId), any(Instant.class))).thenReturn(true);
        assertEquals(sessionId.toString(), decoder.decode(token).getId());
        verify(sessions).isActive(eq(sessionId), any(Instant.class));

        when(sessions.isActive(eq(sessionId), any(Instant.class))).thenReturn(false);
        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
        String wrongIssuer = encode(encoder, now, sessionId.toString(), "other-issuer");
        assertThrows(JwtValidationException.class, () -> decoder.decode(wrongIssuer));
        String malformedId = encode(encoder, now, "not-a-uuid", "markerit-api");
        assertThrows(JwtValidationException.class, () -> decoder.decode(malformedId));
    }

    private String encode(org.springframework.security.oauth2.jwt.JwtEncoder encoder, Instant now, String sessionId, String issuer) {
        var claims = JwtClaimsSet.builder().issuer(issuer).subject("user-id").issuedAt(now)
                .expiresAt(now.plusSeconds(300)).id(sessionId).claim("email", "user@example.com").build();
        return encoder.encode(JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
