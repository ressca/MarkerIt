package pl.markerit.api.feedback.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.feedback.WorkspaceFeedbackService;

class WorkspaceFeedbackControllerTest {

    private WorkspaceFeedbackService feedback;
    private WorkspaceFeedbackController controller;
    private UUID userId;
    private UUID workspaceId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        feedback = mock(WorkspaceFeedbackService.class);
        controller = new WorkspaceFeedbackController(feedback);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void listsFeedbackForTheCurrentUserAndWorkspace() {
        WorkspaceFeedbackResponse response = new WorkspaceFeedbackResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Kampania",
                "sage",
                UUID.randomUUID(),
                "Baner",
                "OPEN",
                UUID.randomUUID(),
                2,
                null,
                12.5,
                44,
                "OPEN",
                userId,
                "Anna Kowalska",
                "AK",
                Instant.now(),
                null,
                null,
                null,
                1,
                "Skróć margines",
                "Jan Nowak",
                "JN",
                Instant.now());
        when(feedback.list(userId, workspaceId)).thenReturn(List.of(response));

        assertEquals(List.of(response), controller.list(jwt, workspaceId));
        verify(feedback).list(userId, workspaceId);
    }
}
