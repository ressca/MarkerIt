package pl.markerit.api.realtime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.reviews.Review;
import pl.markerit.api.reviews.ReviewRepository;
import pl.markerit.api.workspaces.WorkspaceService;

class RealtimeSubscriptionInterceptorTest {

    private ReviewRepository reviews;
    private ProjectService projects;
    private WorkspaceService workspaces;
    private RealtimeSubscriptionInterceptor interceptor;

    private UUID userId;
    private UUID workspaceId;
    private UUID projectId;
    private UUID reviewId;
    private Project project;
    private Review review;

    @BeforeEach void setUp() {
        reviews = mock(ReviewRepository.class);
        projects = mock(ProjectService.class);
        workspaces = mock(WorkspaceService.class);
        interceptor = new RealtimeSubscriptionInterceptor(reviews, projects, workspaces);

        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        projectId = project.getId();
        review = new Review(projectId, "Recenzja", null, userId);
        reviewId = review.getId();
    }

    @Test void allowsSubscriptionToReviewForWorkspaceMember() {
        when(reviews.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(review));
        when(projects.requireProject(projectId)).thenReturn(project);

        Message<?> message = subscribe("/topic/reviews/" + reviewId);

        assertSame(message, interceptor.preSend(message, mock(org.springframework.messaging.MessageChannel.class)));
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void allowsSubscriptionToProjectForWorkspaceMember() {
        when(projects.requireProject(projectId)).thenReturn(project);

        assertNotNull(interceptor.preSend(
                subscribe("/topic/projects/" + projectId),
                mock(org.springframework.messaging.MessageChannel.class)));

        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void rejectsReviewSubscriptionForNonMember() {
        when(reviews.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(review));
        when(projects.requireProject(projectId)).thenReturn(project);
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                subscribe("/topic/reviews/" + reviewId),
                mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test void rejectsProjectSubscriptionForNonMember() {
        when(projects.requireProject(projectId)).thenReturn(project);
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                subscribe("/topic/projects/" + projectId),
                mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test void rejectsUnknownOrMalformedDestinations() {
        var channel = mock(org.springframework.messaging.MessageChannel.class);
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(subscribe("/topic/secret"), channel));
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(subscribe("/topic/reviews/not-a-uuid"), channel));
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(subscribe("/topic/reviews/" + reviewId + "/extra"), channel));
        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(subscribe(null), channel));
    }

    @Test void rejectsMissingReviewAndMissingPrincipal() {
        UUID missingReview = UUID.randomUUID();
        when(reviews.findByIdAndDeletedAtIsNull(missingReview)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                subscribe("/topic/reviews/" + missingReview),
                mock(org.springframework.messaging.MessageChannel.class)));

        Message<byte[]> message = message(
                StompCommand.SUBSCRIBE, "/topic/reviews/" + reviewId, null);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                message, mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test void allowsNonSubscribeClientCommandsFromAllowList() {
        var channel = mock(org.springframework.messaging.MessageChannel.class);
        for (StompCommand command : List.of(
                StompCommand.CONNECT, StompCommand.STOMP, StompCommand.UNSUBSCRIBE,
                StompCommand.DISCONNECT, StompCommand.ACK, StompCommand.NACK)) {
            Message<byte[]> frame = message(command, null, userId.toString());
            assertSame(frame, interceptor.preSend(frame, channel), "command " + command);
        }
        verifyNoInteractions(reviews, projects, workspaces);
    }

    @Test void rejectsClientSendFramesEvenForAuthenticatedUsers() {
        var channel = mock(org.springframework.messaging.MessageChannel.class);
        Message<byte[]> send = message(
                StompCommand.SEND, "/topic/reviews/" + reviewId, userId.toString());

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(send, channel));

        assertNotNull(exception.getMessage());
        verifyNoInteractions(reviews, projects, workspaces);
    }

    @Test void rejectsClientMessageFrames() {
        var channel = mock(org.springframework.messaging.MessageChannel.class);
        Message<byte[]> messageFrame = message(
                StompCommand.MESSAGE, "/topic/projects/" + projectId, userId.toString());

        assertThrows(AccessDeniedException.class,
                () -> interceptor.preSend(messageFrame, channel));
        verifyNoInteractions(reviews, projects, workspaces);
    }

    private Message<byte[]> subscribe(String destination) {
        return message(StompCommand.SUBSCRIBE, destination, userId.toString());
    }

    private Message<byte[]> message(StompCommand command, String destination, String principal) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (destination != null) {
            accessor.setDestination(destination);
        }
        if (principal != null) {
            accessor.setUser(new UsernamePasswordAuthenticationToken(principal, null));
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test void parsesSessionCookieAmongOtherCookies() {
        assertEquals("abc.def", SessionHandshakeInterceptor.sessionToken(
                "theme=dark; markerit_session=abc.def; other=1"));
        assertNull(SessionHandshakeInterceptor.sessionToken("theme=dark"));
        assertNull(SessionHandshakeInterceptor.sessionToken(null));
        assertNull(SessionHandshakeInterceptor.sessionToken("markerit_session"));
    }

    @Test void publisherEventCarriesExpectedFields() {
        assertEquals(ReviewRealtimeEvent.COMMENT_DELETED, "COMMENT_DELETED");
        ReviewRealtimeEvent event = new ReviewRealtimeEvent(
                ReviewRealtimeEvent.REVIEW_UPDATED, projectId, reviewId, UUID.randomUUID(),
                null, null, ReviewRealtimeEvent.PAYLOAD_REVIEW, Instant.now(),
                Map.of("k", "v"));
        assertEquals(reviewId, event.reviewId());
        assertEquals(projectId, event.projectId());
        assertEquals("REVIEW_UPDATED", event.type());
        assertEquals("REVIEW", event.payloadType());
    }
}
