package pl.markerit.api.feedback;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
