package pl.markerit.api.auth;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    boolean existsByIdAndRevokedAtIsNullAndExpiresAtAfter(UUID id, Instant now);
}
