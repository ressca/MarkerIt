package pl.markerit.api.auth.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import pl.markerit.api.users.User;

class JwtTokenServiceTest {
    @Test void encodesIssuerUserSessionAndEmailClaims() {
        JwtEncoder encoder = mock(JwtEncoder.class);
        when(encoder.encode(any(JwtEncoderParameters.class))).thenReturn(
                Jwt.withTokenValue("signed").header("alg", "HS256").claim("sub", "user").build());
        JwtTokenService service = new JwtTokenService(encoder);
        User user = mock(User.class);
        UUID userId = UUID.randomUUID();
        when(user.getId()).thenReturn(userId);
        when(user.getEmail()).thenReturn("user@example.com");
        UserSession session = new UserSession(UUID.randomUUID(), user, Instant.now().plusSeconds(60));

        assertEquals("signed", service.create(user, session, Instant.now()));
        var captor = org.mockito.ArgumentCaptor.forClass(JwtEncoderParameters.class);
        verify(encoder).encode(captor.capture());
        assertEquals(JwtTokenService.ISSUER, captor.getValue().getClaims().getClaim("iss"));
        assertEquals(userId.toString(), captor.getValue().getClaims().getSubject());
        assertEquals("user@example.com", captor.getValue().getClaims().getClaim("email"));
        assertEquals(session.getId().toString(), captor.getValue().getClaims().getId());
    }
}
