package pl.markerit.api.feedback;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PinRepository extends JpaRepository<Pin, UUID> {

    List<Pin> findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(UUID reviewVersionId);

    List<Pin> findByReviewVersionIdIn(Collection<UUID> reviewVersionIds);

    List<Pin> findByReviewVersionIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
            Collection<UUID> reviewVersionIds);

    Optional<Pin> findByIdAndDeletedAtIsNull(UUID id);
}
