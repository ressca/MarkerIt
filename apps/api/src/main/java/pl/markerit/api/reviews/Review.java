package pl.markerit.api.reviews;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A review thread: one image at a time that the team gives feedback on.
 *
 * <p>Only {@code review_reviewers} rows that currently exist count when the
 * thread is closed. Approvals from reviewers that were removed later stay in
 * {@code review_approvals} as history, but they do not block or allow closing.
 * Threads are hard-deleted together with cascade-related rows; the legacy
 * {@code deleted_at} column is not used to soft-delete reviews.</p>
 */
@Entity
@Table(name = "reviews")
public class Review {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_CLOSED = "CLOSED";

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 120)
    private String title;

    private String description;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "closed_by")
    private UUID closedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Review() {
    }

    public Review(UUID projectId, String title, String description, UUID createdBy) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.title = title;
        this.description = description;
        this.status = STATUS_OPEN;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public UUID getClosedBy() {
        return closedBy;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public boolean isClosed() {
        return STATUS_CLOSED.equals(status);
    }

    public void updateDetails(String title, String description, boolean replaceDescription) {
        if (title != null) {
            this.title = title;
        }
        if (replaceDescription) {
            this.description = description;
        }
    }

    public void close(UUID userId) {
        this.status = STATUS_CLOSED;
        this.closedAt = Instant.now();
        this.closedBy = userId;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
