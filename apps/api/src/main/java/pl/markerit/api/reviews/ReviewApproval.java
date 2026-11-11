package pl.markerit.api.reviews;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review_approvals")
public class ReviewApproval {

    public static final String DECISION_APPROVED = "APPROVED";
    public static final String DECISION_CHANGES_REQUESTED = "CHANGES_REQUESTED";

    @Id
    private UUID id;

    @Column(name = "review_id", nullable = false)
    private UUID reviewId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "review_version_id", nullable = false)
    private UUID reviewVersionId;

    @Column(nullable = false, length = 30)
    private String decision;

    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ReviewApproval() {
    }

    public ReviewApproval(
            UUID reviewId,
            UUID reviewVersionId,
            UUID userId,
            String decision,
            String note) {
        this.id = UUID.randomUUID();
        this.reviewId = reviewId;
        this.reviewVersionId = reviewVersionId;
        this.userId = userId;
        this.decision = decision;
        this.note = note;
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

    public UUID getUserId() {
        return userId;
    }

    public UUID getReviewVersionId() {
        return reviewVersionId;
    }

    public String getDecision() {
        return decision;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
