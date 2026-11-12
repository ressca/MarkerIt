package pl.markerit.api.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A pin on a review version image. Pins are soft-deleted so the discussion
 * history stays traceable for audits.
 */
@Entity
@Table(name = "review_pins")
public class Pin {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_RESOLVED = "RESOLVED";

    @Id
    private UUID id;

    @Column(name = "review_version_id", nullable = false)
    private UUID reviewVersionId;

    @Column(name = "asset_id", nullable = false)
    private UUID assetId;

    @Column(name = "x_percent", nullable = false, precision = 6, scale = 3)
    private BigDecimal xPercent;

    @Column(name = "y_percent", nullable = false, precision = 6, scale = 3)
    private BigDecimal yPercent;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Pin() {
    }

    public Pin(
            UUID reviewVersionId,
            UUID assetId,
            double xPercent,
            double yPercent,
            UUID createdBy) {
        this.id = UUID.randomUUID();
        this.reviewVersionId = reviewVersionId;
        this.assetId = assetId;
        this.xPercent = BigDecimal.valueOf(xPercent);
        this.yPercent = BigDecimal.valueOf(yPercent);
        this.status = STATUS_OPEN;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public void resolve(UUID userId) {
        this.status = STATUS_RESOLVED;
        this.resolvedBy = userId;
        this.resolvedAt = Instant.now();
    }

    public void reopen() {
        this.status = STATUS_OPEN;
        this.resolvedBy = null;
        this.resolvedAt = null;
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getReviewVersionId() {
        return reviewVersionId;
    }

    public UUID getAssetId() {
        return assetId;
    }

    public double getXPercent() {
        return xPercent.doubleValue();
    }

    public double getYPercent() {
        return yPercent.doubleValue();
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

    public UUID getResolvedBy() {
        return resolvedBy;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public boolean isResolved() {
        return STATUS_RESOLVED.equals(status);
    }
}
