package pl.markerit.api.workspaces.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.workspaces.WorkspaceService;

class WorkspaceControllerTest {

    private WorkspaceService workspaces;
    private WorkspaceController controller;
    private UUID userId;
    private UUID workspaceId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        workspaces = mock(WorkspaceService.class);
        controller = new WorkspaceController(workspaces);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void listsWorkspacesForCurrentUser() {
        var workspace = new WorkspaceResponse(workspaceId, "Moja przestrzeń", null, "OWNER", 2,
                Instant.now(), Instant.now());
        when(workspaces.listForUser(userId)).thenReturn(List.of(workspace));

        assertEquals(List.of(workspace), controller.list(jwt));
    }

    @Test void createsWorkspace() {
        var request = new CreateWorkspaceRequest("Studio", null);
        var response = new WorkspaceResponse(workspaceId, "Studio", null, "OWNER", 0,
                Instant.now(), Instant.now());
        when(workspaces.create(userId, request)).thenReturn(response);

        assertEquals(response, controller.create(jwt, request));
    }

    @Test void readsUpdatesAndDeletesWorkspace() {
        var response = new WorkspaceResponse(workspaceId, "Studio", null, "OWNER", 0,
                Instant.now(), Instant.now());
        when(workspaces.get(userId, workspaceId)).thenReturn(response);
        when(workspaces.update(eq(userId), eq(workspaceId), any())).thenReturn(response);

        assertEquals(response, controller.get(jwt, workspaceId));
        assertEquals(response, controller.update(jwt, workspaceId,
                new UpdateWorkspaceRequest("Studio", null)));

        controller.delete(jwt, workspaceId);
        verify(workspaces).delete(userId, workspaceId);
    }
}
