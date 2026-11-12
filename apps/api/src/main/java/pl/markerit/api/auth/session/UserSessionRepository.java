package pl.markerit.api.auth.session;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    boolean existsByIdAndRevokedAtIsNullAndExpiresAtAfter(UUID id, Instant now);

    List<UserSession> findByUser_IdAndRevokedAtIsNull(UUID userId);
}
