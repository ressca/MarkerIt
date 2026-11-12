package pl.markerit.api.realtime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.socket.WebSocketHandler;

class SessionHandshakeInterceptorTest {

    private JwtDecoder jwtDecoder;
    private SessionHandshakeInterceptor interceptor;
    private WebSocketHandler handler;
    private UUID userId;

    @BeforeEach void setUp() {
        jwtDecoder = mock(JwtDecoder.class);
        interceptor = new SessionHandshakeInterceptor(jwtDecoder);
        handler = mock(WebSocketHandler.class);
        userId = UUID.randomUUID();
    }

    @Test void acceptsValidSessionCookie() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .build();
        when(jwtDecoder.decode("valid")).thenReturn(jwt);
        var response = mock(ServerHttpResponse.class);
        Map<String, Object> attributes = new HashMap<>();

        assertTrue(interceptor.beforeHandshake(
                request("theme=dark; markerit_session=valid"), response, handler, attributes));
        assertEquals(userId, attributes.get(SessionHandshakeInterceptor.USER_ID_ATTRIBUTE));
        assertNotNull(attributes.get(SessionHandshakeInterceptor.PRINCIPAL_ATTRIBUTE));
        verify(response, never()).setStatusCode(any());
    }

    @Test void rejectsMissingCookie() {
        var response = mock(ServerHttpResponse.class);

        assertFalse(interceptor.beforeHandshake(
                request(null), response, handler, new HashMap<>()));
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test void rejectsInvalidToken() {
        when(jwtDecoder.decode("invalid")).thenThrow(new JwtException("invalid"));
        var response = mock(ServerHttpResponse.class);

        assertFalse(interceptor.beforeHandshake(
                request("markerit_session=invalid"), response, handler, new HashMap<>()));
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test void rejectsMalformedSubject() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("not-a-uuid")
                .build();
        when(jwtDecoder.decode("token-value")).thenReturn(jwt);
        var response = mock(ServerHttpResponse.class);

        assertFalse(interceptor.beforeHandshake(
                request("markerit_session=token-value"), response, handler, new HashMap<>()));
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test void afterHandshakeDoesNothing() {
        assertDoesNotThrow(() -> interceptor.afterHandshake(null, null, handler, null));
    }

    @Test void handshakeHandlerUsesAuthenticatedPrincipal() {
        SessionHandshakeHandler handshakeHandler = new SessionHandshakeHandler();
        var request = request(null);
        Map<String, Object> attributes = new HashMap<>();
        assertNull(handshakeHandler.determineUser(request, handler, attributes));

        var principal = new UsernamePasswordAuthenticationToken(userId.toString(), null);
        attributes.put(SessionHandshakeInterceptor.PRINCIPAL_ATTRIBUTE, principal);
        assertSame(principal, handshakeHandler.determineUser(request, handler, attributes));
    }

    private ServerHttpRequest request(String cookieHeader) {
        ServerHttpRequest request = mock(ServerHttpRequest.class);
        HttpHeaders headers = new HttpHeaders();
        if (cookieHeader != null) {
            headers.set(HttpHeaders.COOKIE, cookieHeader);
        }
        when(request.getHeaders()).thenReturn(headers);
        return request;
    }
}
