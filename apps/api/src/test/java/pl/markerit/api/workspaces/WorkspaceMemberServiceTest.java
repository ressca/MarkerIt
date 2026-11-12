package pl.markerit.api.workspaces;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.web.WorkspaceMemberResponse;

class WorkspaceMemberServiceTest {

    private WorkspaceMemberRepository members;
    private UserRepository users;
    private WorkspaceService workspaces;
    private WorkspaceMemberService service;
    private UUID userId;
    private UUID workspaceId;

    @BeforeEach void setUp() {
        members = mock(WorkspaceMemberRepository.class);
        users = mock(UserRepository.class);
        workspaces = mock(WorkspaceService.class);
        service = new WorkspaceMemberService(members, users, workspaces);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
    }

    @Test void listsMembersWithProfileDetails() {
        UUID otherUserId = UUID.randomUUID();
        User user = mock(User.class);
        when(user.getId()).thenReturn(otherUserId);
        when(user.getDisplayName()).thenReturn("Anna Kowalska");
        when(user.getEmail()).thenReturn("anna@example.com");
        WorkspaceMember member = new WorkspaceMember(workspaceId, otherUserId, "MEMBER", userId);
        when(members.findByWorkspaceIdOrderByCreatedAtAscIdAsc(workspaceId))
                .thenReturn(List.of(member));
        when(users.findAllById(List.of(otherUserId))).thenReturn(List.of(user));

        List<WorkspaceMemberResponse> response = service.list(userId, workspaceId);

        assertEquals(1, response.size());
        assertEquals(otherUserId, response.getFirst().id());
        assertEquals("Anna Kowalska", response.getFirst().displayName());
        assertEquals("anna@example.com", response.getFirst().email());
        assertEquals("AK", response.getFirst().initials());
        assertEquals("MEMBER", response.getFirst().role());
        verify(workspaces).requireMember(workspaceId, userId);
        verify(users, never()).findById(any());
    }

    @Test void fallsBackWhenUserProfileIsMissing() {
        UUID missingUserId = UUID.randomUUID();
        WorkspaceMember member = new WorkspaceMember(workspaceId, missingUserId, "VIEWER", userId);
        when(members.findByWorkspaceIdOrderByCreatedAtAscIdAsc(workspaceId))
                .thenReturn(List.of(member));
        when(users.findAllById(List.of(missingUserId))).thenReturn(List.of());

        WorkspaceMemberResponse response = service.list(userId, workspaceId).getFirst();

        assertEquals("Usunięty użytkownik", response.displayName());
        assertEquals("", response.email());
        assertEquals("UU", response.initials());
    }
}
