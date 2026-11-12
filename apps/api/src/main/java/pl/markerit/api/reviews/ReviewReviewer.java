package pl.markerit.api.reviews;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "review_reviewers")
public class ReviewReviewer {

    @EmbeddedId
    private ReviewReviewerId id;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ReviewReviewer() {
    }

    public ReviewReviewer(UUID reviewId, UUID userId, UUID addedBy) {
        this.id = new ReviewReviewerId(reviewId, userId);
        this.addedBy = addedBy;
        this.createdAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public ReviewReviewerId getId() {
        return id;
    }

    public UUID getReviewId() {
        return id.getReviewId();
    }

    public UUID getUserId() {
        return id.getUserId();
    }

    public UUID getAddedBy() {
        return addedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Embeddable
    public static class ReviewReviewerId implements Serializable {

        @Column(name = "review_id", nullable = false)
        private UUID reviewId;

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        protected ReviewReviewerId() {
        }

        public ReviewReviewerId(UUID reviewId, UUID userId) {
            this.reviewId = reviewId;
            this.userId = userId;
        }

        public UUID getReviewId() {
            return reviewId;
        }

        public UUID getUserId() {
            return userId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof ReviewReviewerId that)) return false;
            return Objects.equals(reviewId, that.reviewId)
                    && Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(reviewId, userId);
        }
    }
}
