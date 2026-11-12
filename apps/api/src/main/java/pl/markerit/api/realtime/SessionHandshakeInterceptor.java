package pl.markerit.api.realtime;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import pl.markerit.api.security.SecurityConfiguration;

/**
 * Authenticates the native WebSocket handshake with the session JWT stored in
 * the {@code markerit_session} cookie. The decoder also checks that the session
 * has not been revoked, exactly like the HTTP bearer-token resolver.
 */
@Component
public class SessionHandshakeInterceptor implements HandshakeInterceptor {

    public static final String PRINCIPAL_ATTRIBUTE = "pl.markerit.realtime.principal";
    public static final String USER_ID_ATTRIBUTE = "pl.markerit.realtime.userId";
    /** JWT {@code jti}: the database session id used by logout revocation. */
    public static final String AUTH_SESSION_ID_ATTRIBUTE = "pl.markerit.realtime.authSessionId";

    private final JwtDecoder jwtDecoder;

    public SessionHandshakeInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        String token = sessionToken(request.getHeaders().getFirst(HttpHeaders.COOKIE));
        if (token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            Jwt jwt = jwtDecoder.decode(token);
            UUID userId = UUID.fromString(jwt.getSubject());
            JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt);
            attributes.put(PRINCIPAL_ATTRIBUTE, authentication);
            attributes.put(USER_ID_ATTRIBUTE, userId);
            if (jwt.getId() != null) {
                attributes.put(AUTH_SESSION_ID_ATTRIBUTE, jwt.getId());
            }
            return true;
        } catch (RuntimeException exception) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // Nothing to clean up.
    }

    static String sessionToken(String cookieHeader) {
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return null;
        }
        for (String part : cookieHeader.split(";")) {
            String trimmed = part.trim();
            int separator = trimmed.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String name = trimmed.substring(0, separator).trim();
            if (SecurityConfiguration.SESSION_COOKIE.equals(name)) {
                return trimmed.substring(separator + 1);
            }
        }
        return null;
    }
}
