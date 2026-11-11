package pl.markerit.api.reviews;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review_versions")
public class ReviewVersion {

    @Id
    private UUID id;

    @Column(name = "review_id", nullable = false)
    private UUID reviewId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    private String note;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ReviewVersion() {
    }

    public ReviewVersion(UUID reviewId, int versionNumber, String note, UUID createdBy) {
        this.id = UUID.randomUUID();
        this.reviewId = reviewId;
        this.versionNumber = versionNumber;
        this.note = note;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getReviewId() {
        return reviewId;
    }

    public int getVersionNumber() {
        return versionNumber;
    }

    public String getNote() {
        return note;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
