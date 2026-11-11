package pl.markerit.api.projects;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProjectTest {

    @Test void exposesFieldsAndTracksArchiving() {
        UUID workspaceId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Project project = new Project(workspaceId, "Makieta", "makieta", "Opis", "blue", userId);

        assertNotNull(project.getId());
        assertEquals(workspaceId, project.getWorkspaceId());
        assertEquals("Makieta", project.getName());
        assertEquals("makieta", project.getSlug());
        assertEquals("Opis", project.getDescription());
        assertEquals(Project.STATUS_ACTIVE, project.getStatus());
        assertEquals("WORKSPACE", project.getVisibility());
        assertEquals("blue", project.getTone());
        assertEquals(userId, project.getCreatedBy());

        project.update("Nowa", "Nowy opis", Project.STATUS_CLOSED, "sand");
        assertEquals("Nowa", project.getName());
        assertEquals("Nowy opis", project.getDescription());
        assertEquals(Project.STATUS_CLOSED, project.getStatus());
        assertEquals("sand", project.getTone());
        assertNotNull(project.getArchivedAt());

        project.update(null, null, Project.STATUS_ACTIVE, null);
        assertNull(project.getArchivedAt());

        project.softDelete();
        assertNotNull(project.getDeletedAt());
    }
}
