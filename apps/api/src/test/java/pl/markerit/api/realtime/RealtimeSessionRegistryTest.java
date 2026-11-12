package pl.markerit.api.realtime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

class RealtimeSessionRegistryTest {

    private RealtimeSessionRegistry registry;
    private UUID userId;

    @BeforeEach void setUp() {
        registry = new RealtimeSessionRegistry();
        userId = UUID.randomUUID();
    }

    @Test void closesOnlySessionsForRevokedAuthSession() throws Exception {
        String authSessionId = UUID.randomUUID().toString();
        WebSocketSession target = socket("socket-1", authSessionId, userId);
        WebSocketSession other = socket("socket-2", UUID.randomUUID().toString(), userId);
        registry.registerSocket(target);
        registry.registerSocket(other);

        assertEquals(1, registry.closeAuthSession(authSessionId));

        verify(target).close(CloseStatus.POLICY_VIOLATION);
        verify(other, never()).close(any());
        assertEquals(1, registry.activeSessionCount());
    }

    @Test void closesEverySessionForMembershipRemoval() throws Exception {
        WebSocketSession first = socket("socket-1", UUID.randomUUID().toString(), userId);
        WebSocketSession second = socket("socket-2", UUID.randomUUID().toString(), userId);
        WebSocketSession unrelated = socket(
                "socket-3", UUID.randomUUID().toString(), UUID.randomUUID());
        registry.registerSocket(first);
        registry.registerSocket(second);
        registry.registerSocket(unrelated);

        assertEquals(2, registry.closeForMembershipRemoval(userId));

        verify(first).close(CloseStatus.POLICY_VIOLATION);
        verify(second).close(CloseStatus.POLICY_VIOLATION);
        verify(unrelated, never()).close(any());
    }

    @Test void disconnectEventForgetsSession() throws Exception {
        WebSocketSession session = socket("socket-1", UUID.randomUUID().toString(), userId);
        registry.registerSocket(session);
        registry.onSessionDisconnect(new SessionDisconnectEvent(
                this, connectedMessage("socket-1", null, null), "socket-1",
                CloseStatus.NORMAL));

        assertEquals(0, registry.activeSessionCount());
        assertEquals(0, registry.closeForMembershipRemoval(userId));
    }

    @Test void connectedEventCompletesMissingMappings() throws Exception {
        String authSessionId = UUID.randomUUID().toString();
        WebSocketSession session = socket("socket-1", null, null);
        registry.registerSocket(session);

        registry.onSessionConnected(new SessionConnectedEvent(
                this, connectedMessage("socket-1", authSessionId, userId)));

        assertEquals(1, registry.closeAuthSession(authSessionId));
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test void ignoresInvalidAndClosedSessions() throws Exception {
        WebSocketSession closed = socket("socket-1", "auth-session", userId);
        when(closed.isOpen()).thenReturn(false);
        registry.registerSocket(closed);

        assertEquals(1, registry.closeAuthSession("auth-session"));
        verify(closed, never()).close(any());
        assertEquals(0, registry.closeAuthSession(null));
        assertEquals(0, registry.closeForMembershipRemoval(null));

        WebSocketSession failing = socket("socket-2", "auth-session", userId);
        doThrow(new java.io.IOException("already gone")).when(failing)
                .close(CloseStatus.POLICY_VIOLATION);
        registry.registerSocket(failing);
        assertDoesNotThrow(() -> registry.closeAuthSession("auth-session"));
        assertEquals(0, registry.activeSessionCount());
    }

    private WebSocketSession socket(String id, String authSessionId, UUID owner) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        Map<String, Object> attributes = new HashMap<>();
        if (authSessionId != null) {
            attributes.put(SessionHandshakeInterceptor.AUTH_SESSION_ID_ATTRIBUTE, authSessionId);
        }
        if (owner != null) {
            attributes.put(SessionHandshakeInterceptor.USER_ID_ATTRIBUTE, owner);
        }
        when(session.getAttributes()).thenReturn(attributes);
        return session;
    }

    private Message<byte[]> connectedMessage(
            String socketId, String authSessionId, UUID owner) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECTED);
        accessor.setSessionId(socketId);
        Map<String, Object> attributes = new HashMap<>();
        if (authSessionId != null) {
            attributes.put(SessionHandshakeInterceptor.AUTH_SESSION_ID_ATTRIBUTE, authSessionId);
        }
        if (owner != null) {
            attributes.put(SessionHandshakeInterceptor.USER_ID_ATTRIBUTE, owner);
        }
        accessor.setSessionAttributes(attributes);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
