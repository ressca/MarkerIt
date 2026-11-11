package pl.markerit.api.workspaces;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workspace_members")
public class WorkspaceMember {

    @Id
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(name = "invited_by")
    private UUID invitedBy;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected WorkspaceMember() {
    }

    public WorkspaceMember(UUID workspaceId, UUID userId, String role, UUID invitedBy) {
        this.id = UUID.randomUUID();
        this.workspaceId = workspaceId;
        this.userId = userId;
        this.role = role;
        this.invitedBy = invitedBy;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.joinedAt = now;
        this.createdAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getWorkspaceId() {
        return workspaceId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public boolean canEditWorkspace() {
        return "OWNER".equals(role) || "ADMIN".equals(role);
    }

    public boolean canCreateProjects() {
        return "OWNER".equals(role) || "ADMIN".equals(role) || "MEMBER".equals(role);
    }

    public boolean canWriteReviews() {
        return canCreateProjects();
    }
}
