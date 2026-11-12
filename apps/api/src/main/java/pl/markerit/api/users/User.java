package pl.markerit.api.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id;

    @Column(nullable = false, length = 320, unique = true)
    private String email;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(nullable = false, length = 10)
    private String locale;

    @Column(name = "avatar_asset_id")
    private UUID avatarAssetId;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected User() {
    }

    User(String email, String passwordHash) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.displayName = displayNameFrom(email);
        this.passwordHash = passwordHash;
        this.locale = "pl";
    }

    @PrePersist
    void setTimestamps() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.displayName == null || this.displayName.isBlank()) {
            this.displayName = displayNameFrom(email);
        }
        if (this.locale == null) {
            this.locale = "pl";
        }
    }

    private static String displayNameFrom(String email) {
        String localPart = email == null ? "" : email.split("@", 2)[0];
        return localPart.isBlank() ? "Użytkownik" : localPart;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getDisplayName() {
        return displayName;
    }

    String getPasswordHash() {
        return passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public UUID getAvatarAssetId() {
        return avatarAssetId;
    }

    public String getLocale() {
        return locale;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void verifyEmail() {
        this.emailVerified = true;
    }

    public void touchLastSeen() {
        this.lastSeenAt = Instant.now();
        this.updatedAt = this.lastSeenAt;
    }

    public void updateProfile(String displayName, String locale, UUID avatarAssetId) {
        if (displayName != null && !displayName.isBlank()) {
            this.displayName = displayName.trim();
        }
        if (locale != null && !locale.isBlank()) {
            this.locale = locale.trim();
        }
        this.avatarAssetId = avatarAssetId;
        this.updatedAt = Instant.now();
    }

    public void updateDisplayName(String displayName) {
        this.displayName = displayName.trim();
        this.updatedAt = Instant.now();
    }

    public void updateLocale(String locale) {
        this.locale = locale.trim().toLowerCase(java.util.Locale.ROOT);
        this.updatedAt = Instant.now();
    }

    public void setAvatarAssetId(UUID avatarAssetId) {
        this.avatarAssetId = avatarAssetId;
        this.updatedAt = Instant.now();
    }

    public void changeEmail(String email) {
        this.email = email.trim().toLowerCase(java.util.Locale.ROOT);
        // The change is only applied after the one-time code sent to the new
        // address was verified, so the address is verified by definition.
        this.emailVerified = true;
        this.updatedAt = Instant.now();
    }

    public void changePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        this.updatedAt = Instant.now();
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
        this.updatedAt = this.deletedAt;
    }
}
