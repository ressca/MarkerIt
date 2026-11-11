package pl.markerit.api.workspaces;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkspaceTest {

    @Test void exposesFieldsAndRenames() {
        UUID ownerId = UUID.randomUUID();
        Workspace workspace = new Workspace(ownerId, "Studio", "studio", "Opis");

        assertNotNull(workspace.getId());
        assertEquals(ownerId, workspace.getOwnerId());
        assertEquals("Studio", workspace.getName());
        assertEquals("studio", workspace.getSlug());
        assertEquals("Opis", workspace.getDescription());
        assertNull(workspace.getAvatarUrl());
        assertNull(workspace.getDeletedAt());

        workspace.onCreate();
        assertNotNull(workspace.getCreatedAt());
        assertNotNull(workspace.getUpdatedAt());
        workspace.onUpdate();
        assertNotNull(workspace.getUpdatedAt());

        workspace.rename("Nowa nazwa", null);
        assertEquals("Nowa nazwa", workspace.getName());
        assertNull(workspace.getDescription());

        workspace.softDelete();
        assertNotNull(workspace.getDeletedAt());
    }
}
