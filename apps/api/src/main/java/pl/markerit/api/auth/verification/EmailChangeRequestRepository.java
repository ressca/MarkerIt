package pl.markerit.api.auth.verification;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailChangeRequestRepository extends JpaRepository<EmailChangeRequest, UUID> {
}
