package pl.markerit.api.projects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "projects")
public class Project {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_IN_REVIEW = "IN_REVIEW";
    public static final String STATUS_CLOSED = "CLOSED";

    @Id
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 60)
    private String slug;

    private String description;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false, length = 20)
    private String visibility;

    @Column(nullable = false, length = 20)
    private String tone;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Project() {
    }

    public Project(UUID workspaceId, String name, String slug, String description, String tone, UUID createdBy) {
        this.id = UUID.randomUUID();
        this.workspaceId = workspaceId;
        this.name = name;
        this.slug = slug;
        this.description = description;
        this.status = STATUS_ACTIVE;
        this.visibility = "WORKSPACE";
        this.tone = tone;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getWorkspaceId() {
        return workspaceId;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public String getVisibility() {
        return visibility;
    }

    public String getTone() {
        return tone;
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

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void update(String name, String description, String status, String tone) {
        this.updatedAt = Instant.now();
        if (name != null) {
            this.name = name;
        }
        if (description != null) {
            this.description = description;
        }
        if (tone != null) {
            this.tone = tone;
        }
        if (status != null) {
            this.status = status;
            this.archivedAt = STATUS_CLOSED.equals(status) ? Instant.now() : null;
        }
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
        this.updatedAt = this.deletedAt;
    }
}
