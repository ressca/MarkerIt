package pl.markerit.api.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "pin_comment_attachments")
public class PinCommentAttachment {

    @EmbeddedId
    private PinCommentAttachmentId id;

    @Column(nullable = false)
    private int position;

    protected PinCommentAttachment() {
    }

    public PinCommentAttachment(UUID pinCommentId, UUID assetId, int position) {
        this.id = new PinCommentAttachmentId(pinCommentId, assetId);
        this.position = position;
    }

    public UUID getPinCommentId() {
        return id.getPinCommentId();
    }

    public UUID getAssetId() {
        return id.getAssetId();
    }

    public int getPosition() {
        return position;
    }

    @Embeddable
    public static class PinCommentAttachmentId implements Serializable {

        @Column(name = "pin_comment_id", nullable = false)
        private UUID pinCommentId;

        @Column(name = "asset_id", nullable = false)
        private UUID assetId;

        protected PinCommentAttachmentId() {
        }

        public PinCommentAttachmentId(UUID pinCommentId, UUID assetId) {
            this.pinCommentId = pinCommentId;
            this.assetId = assetId;
        }

        public UUID getPinCommentId() {
            return pinCommentId;
        }

        public UUID getAssetId() {
            return assetId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof PinCommentAttachmentId that)) return false;
            return Objects.equals(pinCommentId, that.pinCommentId)
                    && Objects.equals(assetId, that.assetId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(pinCommentId, assetId);
        }
    }
}
