package pl.markerit.api.auth.verification;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailChangeRequestRepository extends JpaRepository<EmailChangeRequest, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from EmailChangeRequest request where request.userId = :userId")
    Optional<EmailChangeRequest> findByUserIdForUpdate(@Param("userId") UUID userId);
}
