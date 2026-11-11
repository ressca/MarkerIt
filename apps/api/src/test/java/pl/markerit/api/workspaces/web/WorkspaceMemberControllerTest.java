package pl.markerit.api.workspaces.web;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import pl.markerit.api.workspaces.WorkspaceMemberService;

class WorkspaceMemberControllerTest {

    private WorkspaceMemberService members;
    private WorkspaceMemberController controller;
    private UUID userId;
    private UUID workspaceId;
    private Jwt jwt;

    @BeforeEach void setUp() {
        members = mock(WorkspaceMemberService.class);
        controller = new WorkspaceMemberController(members);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject(userId.toString()).build();
    }

    @Test void listsWorkspaceMembers() {
        WorkspaceMemberResponse member = new WorkspaceMemberResponse(
                userId, "Anna Kowalska", "anna@example.com", "AK", "OWNER");
        when(members.list(userId, workspaceId)).thenReturn(List.of(member));

        assertEquals(List.of(member), controller.list(jwt, workspaceId));
    }
}
