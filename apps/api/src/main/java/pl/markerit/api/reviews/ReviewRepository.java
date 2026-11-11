package pl.markerit.api.reviews;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(UUID projectId);

    Optional<Review> findByIdAndDeletedAtIsNull(UUID id);

    /**
     * Serializes version creation for a single thread so version numbers can be
     * derived from the current maximum without racing other requests.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Review r where r.id = :id and r.deletedAt is null")
    Optional<Review> findByIdForUpdate(@Param("id") UUID id);
}
