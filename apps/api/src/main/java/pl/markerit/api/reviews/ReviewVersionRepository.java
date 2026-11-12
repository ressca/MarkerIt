package pl.markerit.api.reviews;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewVersionRepository extends JpaRepository<ReviewVersion, UUID> {

    List<ReviewVersion> findByReviewIdOrderByVersionNumberAsc(UUID reviewId);

    List<ReviewVersion> findByReviewIdInOrderByReviewIdAscVersionNumberAsc(Collection<UUID> reviewIds);

    Optional<ReviewVersion> findFirstByReviewIdOrderByVersionNumberDesc(UUID reviewId);
}
