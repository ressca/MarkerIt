package pl.markerit.api.workspaces;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkspaceMemberTest {

    @Test void exposesRoleCapabilities() {
        UUID workspaceId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        WorkspaceMember owner = new WorkspaceMember(workspaceId, userId, "OWNER", userId);
        WorkspaceMember admin = new WorkspaceMember(workspaceId, userId, "ADMIN", userId);
        WorkspaceMember member = new WorkspaceMember(workspaceId, userId, "MEMBER", userId);
        WorkspaceMember viewer = new WorkspaceMember(workspaceId, userId, "VIEWER", userId);

        assertEquals(workspaceId, owner.getWorkspaceId());
        assertEquals(userId, owner.getUserId());
        assertEquals("OWNER", owner.getRole());
        assertNotNull(owner.getId());

        assertTrue(owner.canEditWorkspace());
        assertTrue(admin.canEditWorkspace());
        assertFalse(member.canEditWorkspace());
        assertFalse(viewer.canEditWorkspace());

        assertTrue(owner.canCreateProjects());
        assertTrue(admin.canCreateProjects());
        assertTrue(member.canCreateProjects());
        assertFalse(viewer.canCreateProjects());
    }
}
