package pl.markerit.api.realtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Tracks authenticated STOMP sessions so they can be closed when the underlying
 * HTTP session is revoked (logout today, workspace membership removal later).
 *
 * <p>A STOMP session id is the same as the native WebSocket session id. The
 * handshake stores the JWT {@code jti} (the database session id) and the user
 * id in the WebSocket attributes; this registry exposes both indexes. Closing a
 * revoked session uses the STOMP {@code POLICY_VIOLATION} close status so
 * clients can distinguish it from a network drop and re-authenticate.</p>
 */
@Component
public class RealtimeSessionRegistry {

    private static final Logger LOGGER = LoggerFactory.getLogger(RealtimeSessionRegistry.class);

    private final Map<String, TrackedSession> sessions = new ConcurrentHashMap<>();

    /** Called by the WebSocket decorator as soon as the socket is established. */
    public void registerSocket(WebSocketSession socket) {
        Map<String, Object> attributes = socket.getAttributes();
        String authSessionId = stringAttribute(attributes,
                SessionHandshakeInterceptor.AUTH_SESSION_ID_ATTRIBUTE);
        UUID userId = uuidAttribute(attributes,
                SessionHandshakeInterceptor.USER_ID_ATTRIBUTE);
        sessions.put(socket.getId(), new TrackedSession(socket, authSessionId, userId));
    }

    public void unregisterSocket(String socketId) {
        if (socketId != null) {
            sessions.remove(socketId);
        }
    }

    @EventListener
    public void onSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String socketId = accessor.getSessionId();
        if (socketId == null) {
            return;
        }
        String authSessionId = stringAttribute(
                accessor.getSessionAttributes(),
                SessionHandshakeInterceptor.AUTH_SESSION_ID_ATTRIBUTE);
        UUID userId = uuidAttribute(
                accessor.getSessionAttributes(),
                SessionHandshakeInterceptor.USER_ID_ATTRIBUTE);
        sessions.computeIfPresent(socketId, (id, tracked) -> new TrackedSession(
                tracked.socket(),
                authSessionId != null ? authSessionId : tracked.authSessionId(),
                userId != null ? userId : tracked.userId()));
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        unregisterSocket(event.getSessionId());
    }

    /**
     * Closes every WebSocket session created from the given JWT {@code jti}.
     *
     * @return number of sessions that were closed
     */
    public int closeAuthSession(String authSessionId) {
        if (authSessionId == null || authSessionId.isBlank()) {
            return 0;
        }
        return closeMatching(session -> authSessionId.equals(session.authSessionId()));
    }

    /**
     * Closes every WebSocket session belonging to the user. Intended for future
     * membership removal flows; logout should prefer {@link #closeAuthSession}
     * so other devices stay signed in.
     *
     * @return number of sessions that were closed
     */
    public int closeForMembershipRemoval(UUID userId) {
        if (userId == null) {
            return 0;
        }
        return closeMatching(session -> userId.equals(session.userId()));
    }

    int activeSessionCount() {
        return sessions.size();
    }

    private int closeMatching(java.util.function.Predicate<TrackedSession> predicate) {
        List<Map.Entry<String, TrackedSession>> matches = new ArrayList<>();
        for (Map.Entry<String, TrackedSession> entry : sessions.entrySet()) {
            if (predicate.test(entry.getValue())) {
                matches.add(entry);
            }
        }
        int closed = 0;
        for (Map.Entry<String, TrackedSession> entry : matches) {
            if (sessions.remove(entry.getKey(), entry.getValue())) {
                closed++;
                closeQuietly(entry.getValue().socket());
            }
        }
        return closed;
    }

    private void closeQuietly(WebSocketSession socket) {
        try {
            if (socket.isOpen()) {
                socket.close(CloseStatus.POLICY_VIOLATION);
            }
        } catch (Exception exception) {
            LOGGER.warn(
                    "Nie udało się zamknąć sesji WebSocket {} po unieważnieniu sesji.",
                    socket.getId(),
                    exception);
        }
    }

    private static String stringAttribute(Map<String, Object> attributes, String name) {
        if (attributes == null) {
            return null;
        }
        Object value = attributes.get(name);
        return value instanceof String text ? text : null;
    }

    private static UUID uuidAttribute(Map<String, Object> attributes, String name) {
        if (attributes == null) {
            return null;
        }
        Object value = attributes.get(name);
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof String text) {
            try {
                return UUID.fromString(text);
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }

    private record TrackedSession(WebSocketSession socket, String authSessionId, UUID userId) {
    }
}
