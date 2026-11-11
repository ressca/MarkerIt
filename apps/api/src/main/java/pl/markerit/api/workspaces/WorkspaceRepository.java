package pl.markerit.api.workspaces;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    Optional<Workspace> findByIdAndDeletedAtIsNull(UUID id);

    long countByOwnerIdAndDeletedAtIsNull(UUID ownerId);

    boolean existsBySlugIgnoreCaseAndDeletedAtIsNull(String slug);

    @Query("""
            select w from Workspace w
            where w.deletedAt is null
              and exists (
                select 1 from WorkspaceMember m
                where m.workspaceId = w.id and m.userId = :userId
              )
            order by w.createdAt asc
            """)
    List<Workspace> findAllForUser(@Param("userId") UUID userId);

    @Query("select w.slug from Workspace w where w.slug like :prefix%")
    List<String> findSlugsStartingWith(@Param("prefix") String prefix);
}
