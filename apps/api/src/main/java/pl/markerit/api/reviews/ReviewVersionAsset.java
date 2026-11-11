package pl.markerit.api.reviews;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "review_version_assets")
public class ReviewVersionAsset {

    @EmbeddedId
    private ReviewVersionAssetId id;

    @Column(nullable = false)
    private int position;

    protected ReviewVersionAsset() {
    }

    public ReviewVersionAsset(UUID reviewVersionId, UUID assetId, int position) {
        this.id = new ReviewVersionAssetId(reviewVersionId, assetId);
        this.position = position;
    }

    public ReviewVersionAssetId getId() {
        return id;
    }

    public UUID getReviewVersionId() {
        return id.getReviewVersionId();
    }

    public UUID getAssetId() {
        return id.getAssetId();
    }

    public int getPosition() {
        return position;
    }

    @Embeddable
    public static class ReviewVersionAssetId implements Serializable {

        @Column(name = "review_version_id", nullable = false)
        private UUID reviewVersionId;

        @Column(name = "asset_id", nullable = false)
        private UUID assetId;

        protected ReviewVersionAssetId() {
        }

        public ReviewVersionAssetId(UUID reviewVersionId, UUID assetId) {
            this.reviewVersionId = reviewVersionId;
            this.assetId = assetId;
        }

        public UUID getReviewVersionId() {
            return reviewVersionId;
        }

        public UUID getAssetId() {
            return assetId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof ReviewVersionAssetId that)) return false;
            return Objects.equals(reviewVersionId, that.reviewVersionId)
                    && Objects.equals(assetId, that.assetId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(reviewVersionId, assetId);
        }
    }
}
