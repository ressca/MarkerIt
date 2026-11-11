package pl.markerit.api.projects;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    List<Project> findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(UUID workspaceId);

    Optional<Project> findByIdAndDeletedAtIsNull(UUID id);

    long countByWorkspaceIdAndDeletedAtIsNull(UUID workspaceId);

    boolean existsByWorkspaceIdAndSlugIgnoreCaseAndDeletedAtIsNull(UUID workspaceId, String slug);
}
