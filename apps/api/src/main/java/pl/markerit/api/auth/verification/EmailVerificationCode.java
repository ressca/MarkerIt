package pl.markerit.api.auth.verification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "email_verification_codes")
public class EmailVerificationCode {
    @Id
    @Column(name = "user_id")
    private UUID userId;

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

    protected EmailVerificationCode() {}

    public EmailVerificationCode(UUID userId, String codeHash, Instant now, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.lastSentAt = now;
        this.expiresAt = expiresAt;
        this.sendWindowStartedAt = now;
        this.sendsInWindow = 1;
    }

    public UUID getUserId() { return userId; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getLastSentAt() { return lastSentAt; }
    public Instant getSendWindowStartedAt() { return sendWindowStartedAt; }
    public int getSendsInWindow() { return sendsInWindow; }
    public int getFailedAttempts() { return failedAttempts; }
    public String getCodeHash() { return codeHash; }

    public void resend(String nextHash, Instant now, Instant nextExpiry) {
        if (!sendWindowStartedAt.plusSeconds(3600).isAfter(now)) {
            sendWindowStartedAt = now;
            sendsInWindow = 0;
        }
        sendsInWindow++;
        lastSentAt = now;
        expiresAt = nextExpiry;
        codeHash = nextHash;
        failedAttempts = 0;
    }

    public void countFailedAttempt() { failedAttempts++; }
}
