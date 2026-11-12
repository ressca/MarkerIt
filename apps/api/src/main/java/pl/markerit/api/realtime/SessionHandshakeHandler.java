package pl.markerit.api.realtime;

import java.security.Principal;
import java.util.Map;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

/**
 * Makes the authenticated JWT available as the STOMP user principal, so
 * channel interceptors can authorize subscriptions per user.
 */
public class SessionHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(
            ServerHttpRequest request,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        Object value = attributes.get(SessionHandshakeInterceptor.PRINCIPAL_ATTRIBUTE);
        return value instanceof Principal principal ? principal : null;
    }
}
