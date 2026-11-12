package pl.markerit.api.feedback;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PinCommentRepository extends JpaRepository<PinComment, UUID> {

    List<PinComment> findByPinIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(UUID pinId);

    List<PinComment> findByPinIdInAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(
            Collection<UUID> pinIds);

    /** Includes deleted tombstones so reply trees stay complete. */
    List<PinComment> findByPinIdInOrderByCreatedAtAscIdAsc(Collection<UUID> pinIds);

    /** Includes deleted tombstones; used when hard-deleting a review. */
    List<PinComment> findByPinIdIn(Collection<UUID> pinIds);

    List<PinComment> findByPinIdAndDeletedAtIsNull(UUID pinId);

    Optional<PinComment> findByIdAndDeletedAtIsNull(UUID id);

    /** Active feedback comments in open reviews/pins of one project. */
    @Query("""
            select count(c)
            from PinComment c
            join Pin p on p.id = c.pinId
            join ReviewVersion v on v.id = p.reviewVersionId
            join Review r on r.id = v.reviewId
            where r.projectId = :projectId
              and r.deletedAt is null
              and r.status = 'OPEN'
              and v.versionNumber = (
                  select max(v2.versionNumber)
                  from ReviewVersion v2
                  where v2.reviewId = r.id
              )
              and p.deletedAt is null
              and p.status = 'OPEN'
              and c.deletedAt is null
            """)
    long countOpenForProject(@Param("projectId") UUID projectId);
}
