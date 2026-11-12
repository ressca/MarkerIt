package pl.markerit.api.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pin_comments")
public class PinComment {

    @Id
    private UUID id;

    @Column(name = "pin_id", nullable = false)
    private UUID pinId;

    @Column(name = "parent_comment_id")
    private UUID parentCommentId;

    @Column(name = "author_id")
    private UUID authorId;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected PinComment() {
    }

    public PinComment(UUID pinId, UUID parentCommentId, UUID authorId, String body) {
        this.id = UUID.randomUUID();
        this.pinId = pinId;
        this.parentCommentId = parentCommentId;
        this.authorId = authorId;
        this.body = body;
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

    public void edit(String body) {
        this.body = body;
        this.editedAt = Instant.now();
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getPinId() {
        return pinId;
    }

    public UUID getParentCommentId() {
        return parentCommentId;
    }

    public UUID getAuthorId() {
        return authorId;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }
}
