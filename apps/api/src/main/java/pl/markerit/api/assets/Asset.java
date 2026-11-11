package pl.markerit.api.assets;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "assets")
public class Asset {

    public static final String PURPOSE_REVIEW_IMAGE = "REVIEW_IMAGE";
    public static final String KIND_IMAGE = "IMAGE";
    public static final String STATUS_READY = "READY";

    @Id
    private UUID id;

    @Column(name = "workspace_id")
    private UUID workspaceId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(nullable = false, length = 20)
    private String purpose;

    @Column(nullable = false, length = 20)
    private String kind;

    @Column(name = "storage_provider", nullable = false, length = 20)
    private String storageProvider;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "checksum_sha256", length = 64)
    private String checksumSha256;

    private Integer width;

    private Integer height;

    @Column(nullable = false, length = 20)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Asset() {
    }

    public Asset(
            UUID workspaceId,
            UUID projectId,
            UUID ownerUserId,
            String storageProvider,
            String storageKey,
            String originalName,
            String contentType,
            long sizeBytes,
            Integer width,
            Integer height,
            Map<String, Object> metadata) {
        this(workspaceId, projectId, ownerUserId, storageProvider, storageKey, originalName,
                contentType, sizeBytes, width, height, metadata, null);
    }

    public Asset(
            UUID workspaceId,
            UUID projectId,
            UUID ownerUserId,
            String storageProvider,
            String storageKey,
            String originalName,
            String contentType,
            long sizeBytes,
            Integer width,
            Integer height,
            Map<String, Object> metadata,
            String checksumSha256) {
        this.id = UUID.randomUUID();
        this.workspaceId = workspaceId;
        this.projectId = projectId;
        this.ownerUserId = ownerUserId;
        this.purpose = PURPOSE_REVIEW_IMAGE;
        this.kind = KIND_IMAGE;
        this.storageProvider = storageProvider;
        this.storageKey = storageKey;
        this.originalName = originalName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.checksumSha256 = checksumSha256;
        this.width = width;
        this.height = height;
        this.status = STATUS_READY;
        this.metadata = metadata == null ? new HashMap<>() : new HashMap<>(metadata);
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getWorkspaceId() {
        return workspaceId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getOwnerUserId() {
        return ownerUserId;
    }

    public String getPurpose() {
        return purpose;
    }

    public String getKind() {
        return kind;
    }

    public String getStorageProvider() {
        return storageProvider;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getOriginalName() {
        return originalName;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public String getChecksumSha256() {
        return checksumSha256;
    }

    public Integer getWidth() {
        return width;
    }

    public Integer getHeight() {
        return height;
    }

    public String getStatus() {
        return status;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
