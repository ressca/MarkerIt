package pl.markerit.api.auth.verification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Pending e-mail change for one user. The code is sent to the new address and
 * never exposes whether the address already belongs to another account.
 */
@Entity
@Table(name = "email_change_requests")
public class EmailChangeRequest {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "new_email", nullable = false, length = 320)
    private String newEmail;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_sent_at", nullable = false)
    private Instant lastSentAt;

    @Column(name = "send_window_started_at", nullable = false)
    private Instant sendWindowStartedAt;

    @Column(name = "sends_in_window", nullable = false)
    private int sendsInWindow;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    protected EmailChangeRequest() {
    }

    public EmailChangeRequest(
            UUID userId, String newEmail, String codeHash, Instant now, Instant expiresAt) {
        this.userId = userId;
        this.newEmail = newEmail;
        this.codeHash = codeHash;
        this.lastSentAt = now;
        this.expiresAt = expiresAt;
        this.sendWindowStartedAt = now;
        this.sendsInWindow = 1;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getNewEmail() {
        return newEmail;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getLastSentAt() {
        return lastSentAt;
    }

    public Instant getSendWindowStartedAt() {
        return sendWindowStartedAt;
    }

    public int getSendsInWindow() {
        return sendsInWindow;
    }

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public void resend(String newEmail, String nextHash, Instant now, Instant nextExpiry) {
        if (!sendWindowStartedAt.plusSeconds(3600).isAfter(now)) {
            sendWindowStartedAt = now;
            sendsInWindow = 0;
        }
        sendsInWindow++;
        this.newEmail = newEmail;
        codeHash = nextHash;
        lastSentAt = now;
        expiresAt = nextExpiry;
        failedAttempts = 0;
    }

    public void countFailedAttempt() {
        failedAttempts++;
    }
}
