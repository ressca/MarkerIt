package pl.markerit.api.realtime;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/**
 * Native WebSocket (no SockJS) STOMP setup. Clients connect to {@code /ws},
 * subscribe under {@code /topic} and may publish application messages under
 * {@code /app}.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

    private final SessionHandshakeInterceptor handshakeInterceptor;
    private final RealtimeSubscriptionInterceptor subscriptionInterceptor;
    private final RealtimeSessionRegistry sessionRegistry;
    private final String[] allowedOrigins;

    public WebSocketConfiguration(
            SessionHandshakeInterceptor handshakeInterceptor,
            RealtimeSubscriptionInterceptor subscriptionInterceptor,
            RealtimeSessionRegistry sessionRegistry,
            @Value("${app.security.cors-origins}") String allowedOrigins) {
        this.handshakeInterceptor = handshakeInterceptor;
        this.subscriptionInterceptor = subscriptionInterceptor;
        this.sessionRegistry = sessionRegistry;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .setHandshakeHandler(new SessionHandshakeHandler())
                .addInterceptors(handshakeInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
        // Deliver events for one destination in publish order. This is required
        // by the simple broker, which otherwise may interleave messages.
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(subscriptionInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Capture native WebSocket sessions so logout can close them. The
        // WebSocket session id is the same as the STOMP simpSessionId.
        registration.addDecoratorFactory(handler -> new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessionRegistry.registerSocket(session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus)
                    throws Exception {
                sessionRegistry.unregisterSocket(session.getId());
                super.afterConnectionClosed(session, closeStatus);
            }
        });
    }
}
