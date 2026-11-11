package pl.markerit.api.projects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.projects.web.CreateProjectRequest;
import pl.markerit.api.projects.web.UpdateProjectRequest;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceService;

class ProjectServiceTest {

    private ProjectRepository projects;
    private UserRepository users;
    private WorkspaceService workspaces;
    private ProjectService service;
    private UUID userId;
    private UUID workspaceId;

    @BeforeEach void setUp() {
        projects = mock(ProjectRepository.class);
        users = mock(UserRepository.class);
        workspaces = mock(WorkspaceService.class);
        service = new ProjectService(projects, users, workspaces);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
    }

    @Test void listsProjectsWithCreatorDetails() {
        User creator = mock(User.class);
        when(creator.getId()).thenReturn(userId);
        when(creator.getDisplayName()).thenReturn("Anna Kowalska");
        Project project = new Project(workspaceId, "Makieta", "makieta", null, "sage", userId);

        when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId))
                .thenReturn(List.of(project));
        when(users.findById(userId)).thenReturn(Optional.of(creator));

        var response = service.list(userId, workspaceId);

        assertEquals(1, response.size());
        assertEquals("Makieta", response.get(0).name());
        assertEquals("Anna Kowalska", response.get(0).createdByName());
        assertEquals("AK", response.get(0).members().get(0).initials());
        assertEquals(0, response.get(0).openComments());
    }

    @Test void readsProjectForWorkspaceMember() {
        User creator = mock(User.class);
        when(creator.getId()).thenReturn(userId);
        when(creator.getDisplayName()).thenReturn("Anna Kowalska");
        Project project = new Project(workspaceId, "Makieta", "makieta", "Opis", "sage", userId);

        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "MEMBER", userId));
        when(users.findById(userId)).thenReturn(Optional.of(creator));

        var response = service.get(userId, project.getId());

        assertEquals(project.getId(), response.id());
        assertEquals("Makieta", response.name());
        assertEquals("Opis", response.description());
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void getRejectsMissingProject() {
        UUID projectId = UUID.randomUUID();
        when(projects.findByIdAndDeletedAtIsNull(projectId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.get(userId, projectId));
        verify(workspaces, never()).requireMember(any(), any());
    }

    @Test void getRejectsNonWorkspaceMember() {
        Project project = new Project(workspaceId, "Makieta", "makieta", null, "sage", userId);
        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.get(userId, project.getId()));

        assertEquals("WORKSPACE_FORBIDDEN", exception.getCode());
        verify(users, never()).findById(any());
    }

    @Test void rejectsFourthProject() {
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.countByWorkspaceIdAndDeletedAtIsNull(workspaceId)).thenReturn(3L);

        assertThrows(LimitReachedException.class,
                () -> service.create(userId, workspaceId, new CreateProjectRequest("Nowy", null, "sage")));
        verify(projects, never()).save(any());
    }

    @Test void createsProjectWithGeneratedSlug() {
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.countByWorkspaceIdAndDeletedAtIsNull(workspaceId)).thenReturn(0L);
        when(projects.existsByWorkspaceIdAndSlugIgnoreCaseAndDeletedAtIsNull(any(), anyString()))
                .thenReturn(false);
        when(projects.save(any(Project.class))).thenAnswer(call -> call.getArgument(0));
        when(users.findById(userId)).thenReturn(Optional.empty());

        var response = service.create(userId, workspaceId,
                new CreateProjectRequest("  Nowa makieta  ", " opis ", "blue"));

        assertEquals("Nowa makieta", response.name());
        assertEquals("opis", response.description());
        assertEquals("blue", response.tone());
        assertEquals(Project.STATUS_ACTIVE, response.status());
        verify(projects).save(any(Project.class));
    }

    @Test void rejectsInvalidTone() {
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.countByWorkspaceIdAndDeletedAtIsNull(workspaceId)).thenReturn(0L);

        assertThrows(InvalidRequestException.class,
                () -> service.create(userId, workspaceId, new CreateProjectRequest("Projekt", null, "pink")));
    }

    @Test void viewerCannotUpdateProject() {
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "VIEWER", userId));

        assertThrows(ForbiddenAccessException.class,
                () -> service.update(userId, project.getId(), new UpdateProjectRequest(null, null, "CLOSED", null)));
    }

    @Test void closingProjectMarksItArchived() {
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "MEMBER", userId));
        when(projects.save(any(Project.class))).thenAnswer(call -> call.getArgument(0));
        when(users.findById(userId)).thenReturn(Optional.empty());

        var response = service.update(userId, project.getId(),
                new UpdateProjectRequest(null, null, "CLOSED", null));

        assertEquals(Project.STATUS_CLOSED, response.status());
        assertNotNull(project.getArchivedAt());
    }

    @Test void memberCannotDeleteProject() {
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "MEMBER", userId));

        assertThrows(ForbiddenAccessException.class, () -> service.delete(userId, project.getId()));
    }

    @Test void ownerSoftDeletesProject() {
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(projects.findByIdAndDeletedAtIsNull(project.getId())).thenReturn(Optional.of(project));
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.save(any(Project.class))).thenAnswer(call -> call.getArgument(0));

        service.delete(userId, project.getId());

        assertNotNull(project.getDeletedAt());
        verify(projects).save(project);
    }

    @Test void missingProjectIsReported() {
        UUID projectId = UUID.randomUUID();
        when(projects.findByIdAndDeletedAtIsNull(projectId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.requireProject(projectId));
    }
}
