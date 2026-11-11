package pl.markerit.api.workspaces;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectRepository;
import pl.markerit.api.workspaces.web.CreateWorkspaceRequest;
import pl.markerit.api.workspaces.web.UpdateWorkspaceRequest;

class WorkspaceServiceTest {

    private WorkspaceRepository workspaces;
    private WorkspaceMemberRepository members;
    private ProjectRepository projects;
    private WorkspaceService service;
    private UUID userId;

    @BeforeEach void setUp() {
        workspaces = mock(WorkspaceRepository.class);
        members = mock(WorkspaceMemberRepository.class);
        projects = mock(ProjectRepository.class);
        service = new WorkspaceService(workspaces, members, projects);
        userId = UUID.randomUUID();
    }

    @Test void createsDefaultWorkspaceWhenUserHasNone() {
        AtomicReference<Workspace> saved = new AtomicReference<>();
        when(members.countByUserId(userId)).thenReturn(0L);
        when(workspaces.save(any(Workspace.class))).thenAnswer(call -> {
            Workspace workspace = call.getArgument(0);
            saved.set(workspace);
            return workspace;
        });
        when(members.save(any(WorkspaceMember.class))).thenAnswer(call -> call.getArgument(0));
        when(workspaces.findAllForUser(userId)).thenAnswer(call -> List.of(saved.get()));
        when(members.findByWorkspaceIdAndUserId(any(), eq(userId)))
                .thenReturn(Optional.of(new WorkspaceMember(UUID.randomUUID(), userId, "OWNER", userId)));
        when(projects.countByWorkspaceIdAndDeletedAtIsNull(any())).thenReturn(0L);

        var result = service.listForUser(userId);

        assertEquals(1, result.size());
        assertEquals("Moja przestrzeń", result.get(0).name());
        assertEquals("OWNER", result.get(0).role());
        verify(members).save(any(WorkspaceMember.class));
    }

    @Test void doesNotCreateDefaultWorkspaceTwice() {
        when(members.countByUserId(userId)).thenReturn(1L);
        when(workspaces.findAllForUser(userId)).thenReturn(List.of());
        assertTrue(service.listForUser(userId).isEmpty());
        verify(workspaces, never()).save(any());
    }

    @Test void rejectsFourthOwnedWorkspace() {
        when(workspaces.countByOwnerIdAndDeletedAtIsNull(userId)).thenReturn(3L);
        assertThrows(LimitReachedException.class,
                () -> service.create(userId, new CreateWorkspaceRequest("Czwarta", null)));
        verify(workspaces, never()).save(any());
    }

    @Test void createsWorkspaceAndOwnerMembership() {
        when(workspaces.countByOwnerIdAndDeletedAtIsNull(userId)).thenReturn(0L);
        when(workspaces.existsBySlugIgnoreCaseAndDeletedAtIsNull(anyString())).thenReturn(false);
        when(workspaces.save(any(Workspace.class))).thenAnswer(call -> call.getArgument(0));
        when(members.save(any(WorkspaceMember.class))).thenAnswer(call -> call.getArgument(0));
        when(members.findByWorkspaceIdAndUserId(any(), eq(userId)))
                .thenReturn(Optional.of(new WorkspaceMember(UUID.randomUUID(), userId, "OWNER", userId)));
        when(projects.countByWorkspaceIdAndDeletedAtIsNull(any())).thenReturn(0L);

        var response = service.create(userId, new CreateWorkspaceRequest("  Studio  ", " opis "));

        assertEquals("Studio", response.name());
        assertEquals("opis", response.description());
        assertEquals("OWNER", response.role());
        verify(members).save(any(WorkspaceMember.class));
    }

    @Test void viewerCannotUpdateWorkspace() {
        UUID workspaceId = UUID.randomUUID();
        Workspace workspace = new Workspace(userId, "Studio", "studio", null);
        when(workspaces.findByIdAndDeletedAtIsNull(workspaceId)).thenReturn(Optional.of(workspace));
        when(members.findByWorkspaceIdAndUserId(workspaceId, userId))
                .thenReturn(Optional.of(new WorkspaceMember(workspaceId, userId, "VIEWER", userId)));

        assertThrows(ForbiddenAccessException.class,
                () -> service.update(userId, workspaceId, new UpdateWorkspaceRequest("Nowa", null)));
    }

    @Test void ownerDeletingWorkspaceAlsoSoftDeletesProjects() {
        UUID workspaceId = UUID.randomUUID();
        Workspace workspace = new Workspace(userId, "Studio", "studio", null);
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(workspaces.findByIdAndDeletedAtIsNull(workspaceId)).thenReturn(Optional.of(workspace));
        when(members.findByWorkspaceIdAndUserId(workspaceId, userId))
                .thenReturn(Optional.of(new WorkspaceMember(workspaceId, userId, "OWNER", userId)));
        when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId))
                .thenReturn(List.of(project));
        when(projects.save(any(Project.class))).thenAnswer(call -> call.getArgument(0));

        service.delete(userId, workspaceId);

        assertNotNull(workspace.getDeletedAt());
        assertNotNull(project.getDeletedAt());
        verify(workspaces).save(workspace);
    }

    @Test void missingWorkspaceIsReported() {
        UUID workspaceId = UUID.randomUUID();
        when(workspaces.findByIdAndDeletedAtIsNull(workspaceId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.get(userId, workspaceId));
    }

    @Test void missingMembershipIsForbidden() {
        UUID workspaceId = UUID.randomUUID();
        when(members.findByWorkspaceIdAndUserId(workspaceId, userId)).thenReturn(Optional.empty());
        assertThrows(ForbiddenAccessException.class, () -> service.requireMember(workspaceId, userId));
    }
}
