package pl.markerit.api.realtime;

import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;

class WebSocketConfigurationTest {

    @Test void registersNativeWebSocketEndpointWithConfiguredOrigins() {
        SessionHandshakeInterceptor handshake = mock(SessionHandshakeInterceptor.class);
        RealtimeSubscriptionInterceptor subscriptions = mock(RealtimeSubscriptionInterceptor.class);
        RealtimeSessionRegistry sessions = mock(RealtimeSessionRegistry.class);
        WebSocketConfiguration configuration = new WebSocketConfiguration(
                handshake, subscriptions, sessions,
                "http://localhost:3000, http://localhost:3001");

        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        StompWebSocketEndpointRegistration registration =
                mock(StompWebSocketEndpointRegistration.class);
        when(registry.addEndpoint("/ws")).thenReturn(registration);
        when(registration.setAllowedOriginPatterns(any(String[].class))).thenReturn(registration);
        when(registration.setHandshakeHandler(any())).thenReturn(registration);
        when(registration.addInterceptors(any())).thenReturn(registration);

        configuration.registerStompEndpoints(registry);

        verify(registry).addEndpoint("/ws");
        verify(registration).setAllowedOriginPatterns(
                aryEq(new String[] {"http://localhost:3000", "http://localhost:3001"}));
        verify(registration).setHandshakeHandler(any(SessionHandshakeHandler.class));
        verify(registration).addInterceptors(handshake);
    }

    @Test void configuresBrokerInboundSubscriptionsAndOrdering() {
        SessionHandshakeInterceptor handshake = mock(SessionHandshakeInterceptor.class);
        RealtimeSubscriptionInterceptor subscriptions = mock(RealtimeSubscriptionInterceptor.class);
        RealtimeSessionRegistry sessions = mock(RealtimeSessionRegistry.class);
        WebSocketConfiguration configuration =
                new WebSocketConfiguration(handshake, subscriptions, sessions,
                        "http://localhost:3000");

        MessageBrokerRegistry broker = mock(MessageBrokerRegistry.class);
        configuration.configureMessageBroker(broker);
        verify(broker).enableSimpleBroker("/topic");
        verify(broker).setApplicationDestinationPrefixes("/app");
        verify(broker).setPreservePublishOrder(true);

        ChannelRegistration channel = mock(ChannelRegistration.class);
        configuration.configureClientInboundChannel(channel);
        verify(channel).interceptors(subscriptions);
    }

    @Test void registersSessionTrackingDecorator() {
        SessionHandshakeInterceptor handshake = mock(SessionHandshakeInterceptor.class);
        RealtimeSubscriptionInterceptor subscriptions = mock(RealtimeSubscriptionInterceptor.class);
        RealtimeSessionRegistry sessions = mock(RealtimeSessionRegistry.class);
        WebSocketConfiguration configuration =
                new WebSocketConfiguration(handshake, subscriptions, sessions,
                        "http://localhost:3000");
        WebSocketTransportRegistration transport = mock(WebSocketTransportRegistration.class);

        configuration.configureWebSocketTransport(transport);

        verify(transport).addDecoratorFactory(any(WebSocketHandlerDecoratorFactory.class));
    }
}
