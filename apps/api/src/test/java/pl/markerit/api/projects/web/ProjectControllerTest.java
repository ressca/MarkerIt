package pl.markerit.api.projects.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.projects.ProjectService;

class ProjectControllerTest {

    private ProjectService projects;
    private ProjectController controller;
    private UUID userId;
    private UUID workspaceId;
    private UUID projectId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        projects = mock(ProjectService.class);
        controller = new ProjectController(projects);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void listsAndCreatesProjects() {
        var response = new ProjectResponse(projectId, workspaceId, "Projekt", null, "ACTIVE", "sage",
                userId, "Anna", Instant.now(), Instant.now(), 0, List.of());
        var createRequest = new CreateProjectRequest("Projekt", null, "sage");
        when(projects.list(userId, workspaceId)).thenReturn(List.of(response));
        when(projects.create(userId, workspaceId, createRequest)).thenReturn(response);

        assertEquals(List.of(response), controller.list(jwt, workspaceId));
        assertEquals(response, controller.create(jwt, workspaceId, createRequest));
    }

    @Test void updatesAndDeletesProject() {
        var response = new ProjectResponse(projectId, workspaceId, "Projekt", null, "CLOSED", "sage",
                userId, "Anna", Instant.now(), Instant.now(), 0, List.of());
        var updateRequest = new UpdateProjectRequest(null, null, "CLOSED", null);
        when(projects.update(userId, projectId, updateRequest)).thenReturn(response);

        assertEquals(response, controller.update(jwt, projectId, updateRequest));

        controller.delete(jwt, projectId);
        verify(projects).delete(userId, projectId);
    }
}
