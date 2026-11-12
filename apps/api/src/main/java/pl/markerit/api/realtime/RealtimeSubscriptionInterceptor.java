package pl.markerit.api.realtime;

import java.security.Principal;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.reviews.ReviewRepository;
import pl.markerit.api.workspaces.WorkspaceService;

/**
 * Authorizes STOMP frames. Only a small allow-list of client commands is
 * accepted; in particular a client may never {@code SEND}/{@code MESSAGE} to a
 * broker destination because topics are server-push only. A client may only
 * subscribe to topics for reviews and projects in workspaces it belongs to.
 *
 * <p>Rejected frames surface as STOMP {@code ERROR} frames and the connection
 * is closed by Spring, so a rejected frame is never forwarded to the broker.</p>
 */
@Component
public class RealtimeSubscriptionInterceptor implements ChannelInterceptor {

    private static final String REVIEW_PREFIX = "/topic/reviews/";
    private static final String PROJECT_PREFIX = "/topic/projects/";
    private static final Set<StompCommand> ALLOWED_COMMANDS = EnumSet.of(
            StompCommand.CONNECT,
            StompCommand.STOMP,
            StompCommand.SUBSCRIBE,
            StompCommand.UNSUBSCRIBE,
            StompCommand.DISCONNECT,
            StompCommand.ACK,
            StompCommand.NACK);

    private final ReviewRepository reviews;
    private final ProjectService projects;
    private final WorkspaceService workspaces;

    public RealtimeSubscriptionInterceptor(
            ReviewRepository reviews,
            ProjectService projects,
            WorkspaceService workspaces) {
        this.reviews = reviews;
        this.projects = projects;
        this.workspaces = workspaces;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (!ALLOWED_COMMANDS.contains(command)) {
            // SEND/MESSAGE would let a client forge server-push events on
            // /topic/**; every other command outside the allow-list is
            // equally unexpected. Throwing here makes Spring emit an ERROR
            // frame and stops the message before the broker sees it.
            throw new AccessDeniedException("Niedozwolona komenda STOMP.");
        }
        if (!StompCommand.SUBSCRIBE.equals(command)) {
            return message;
        }

        String destination = accessor.getDestination();
        UUID userId = userId(accessor.getUser());
        if (destination == null || userId == null) {
            throw new AccessDeniedException("Brak dostępu do tego kanału.");
        }

        if (destination.startsWith(REVIEW_PREFIX)) {
            requireReviewAccess(userId, destination.substring(REVIEW_PREFIX.length()));
            return message;
        }
        if (destination.startsWith(PROJECT_PREFIX)) {
            requireProjectAccess(userId, destination.substring(PROJECT_PREFIX.length()));
            return message;
        }
        if (destination.startsWith("/topic/")) {
            throw new AccessDeniedException("Nieznany kanał subskrypcji.");
        }
        return message;
    }

    private UUID userId(Principal principal) {
        if (principal == null || principal.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(principal.getName());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void requireReviewAccess(UUID userId, String reviewPath) {
        UUID reviewId = parseId(reviewPath);
        try {
            UUID projectId = reviews.findByIdAndDeletedAtIsNull(reviewId)
                    .map(review -> review.getProjectId())
                    .orElseThrow(() -> new AccessDeniedException("Nie znaleziono recenzji."));
            Project project = projects.requireProject(projectId);
            workspaces.requireMember(project.getWorkspaceId(), userId);
        } catch (RuntimeException exception) {
            throw new AccessDeniedException("Brak dostępu do tego kanału recenzji.", exception);
        }
    }

    private void requireProjectAccess(UUID userId, String projectPath) {
        UUID projectId = parseId(projectPath);
        try {
            Project project = projects.requireProject(projectId);
            workspaces.requireMember(project.getWorkspaceId(), userId);
        } catch (RuntimeException exception) {
            throw new AccessDeniedException("Brak dostępu do tego kanału projektu.", exception);
        }
    }

    private UUID parseId(String path) {
        if (path == null || path.isBlank() || path.contains("/")) {
            throw new AccessDeniedException("Nieprawidłowy kanał subskrypcji.");
        }
        try {
            return UUID.fromString(path);
        } catch (IllegalArgumentException exception) {
            throw new AccessDeniedException("Nieprawidłowy kanał subskrypcji.");
        }
    }
}
