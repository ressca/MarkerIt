package pl.markerit.api.workspaces;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.common.Slugifier;
import pl.markerit.api.projects.ProjectRepository;
import pl.markerit.api.workspaces.web.CreateWorkspaceRequest;
import pl.markerit.api.workspaces.web.UpdateWorkspaceRequest;
import pl.markerit.api.workspaces.web.WorkspaceResponse;

@Service
public class WorkspaceService {

    public static final int MAX_WORKSPACES_PER_USER = 3;
    private static final String DEFAULT_WORKSPACE_NAME = "Moja przestrzeń";
    private static final String DEFAULT_WORKSPACE_SLUG = "moja-przestrzen";

    private final WorkspaceRepository workspaces;
    private final WorkspaceMemberRepository members;
    private final ProjectRepository projects;

    public WorkspaceService(
            WorkspaceRepository workspaces,
            WorkspaceMemberRepository members,
            ProjectRepository projects) {
        this.workspaces = workspaces;
        this.members = members;
        this.projects = projects;
    }

    @Transactional
    public List<WorkspaceResponse> listForUser(UUID userId) {
        ensureDefaultWorkspace(userId);
        return workspaces.findAllForUser(userId).stream()
                .map(workspace -> toResponse(workspace, userId))
                .toList();
    }

    @Transactional
    public WorkspaceResponse create(UUID userId, CreateWorkspaceRequest request) {
        return toResponse(createWorkspace(userId, request.name(), request.description()), userId);
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse get(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(workspaceId);
        requireMember(workspaceId, userId);
        return toResponse(workspace, userId);
    }

    @Transactional
    public WorkspaceResponse update(UUID userId, UUID workspaceId, UpdateWorkspaceRequest request) {
        Workspace workspace = requireWorkspace(workspaceId);
        WorkspaceMember member = requireMember(workspaceId, userId);
        if (!member.canEditWorkspace()) {
            throw new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak uprawnień do edycji tej przestrzeni.");
        }
        workspace.rename(request.name().trim(), normalizeDescription(request.description()));
        return toResponse(workspaces.save(workspace), userId);
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(workspaceId);
        WorkspaceMember member = requireMember(workspaceId, userId);
        if (!member.canEditWorkspace()) {
            throw new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak uprawnień do usunięcia tej przestrzeni.");
        }
        workspace.softDelete();
        workspaces.save(workspace);

        for (var project : projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId)) {
            project.softDelete();
            projects.save(project);
        }
    }

    @Transactional(readOnly = true)
    public WorkspaceMember requireMember(UUID workspaceId, UUID userId) {
        return members.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ForbiddenAccessException(
                        "WORKSPACE_FORBIDDEN",
                        "Nie masz dostępu do tej przestrzeni roboczej."));
    }

    @Transactional(readOnly = true)
    public Workspace requireWorkspace(UUID workspaceId) {
        return workspaces.findByIdAndDeletedAtIsNull(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "WORKSPACE_NOT_FOUND",
                        "Nie znaleziono przestrzeni roboczej."));
    }

    @Transactional(readOnly = true)
    public WorkspaceMember requireProjectManager(UUID workspaceId, UUID userId) {
        WorkspaceMember member = requireMember(workspaceId, userId);
        if (!member.canCreateProjects()) {
            throw new ForbiddenAccessException(
                    "WORKSPACE_FORBIDDEN",
                    "Twoja rola nie pozwala zarządzać projektami w tej przestrzeni.");
        }
        return member;
    }

    @Transactional
    public void ensureDefaultWorkspace(UUID userId) {
        if (members.countByUserId(userId) > 0) return;

        createInternal(userId, DEFAULT_WORKSPACE_NAME, DEFAULT_WORKSPACE_SLUG, null);
    }

    private WorkspaceResponse toResponse(Workspace workspace, UUID userId) {
        WorkspaceMember member = requireMember(workspace.getId(), userId);
        long projectCount = projects.countByWorkspaceIdAndDeletedAtIsNull(workspace.getId());
        return new WorkspaceResponse(
                workspace.getId(),
                workspace.getName(),
                workspace.getDescription(),
                member.getRole(),
                projectCount,
                workspace.getCreatedAt(),
                workspace.getUpdatedAt());
    }

    private Workspace createWorkspace(UUID userId, String name, String description) {
        if (workspaces.countByOwnerIdAndDeletedAtIsNull(userId) >= MAX_WORKSPACES_PER_USER) {
            throw new LimitReachedException(
                    "WORKSPACE_LIMIT_REACHED",
                    "Możesz mieć maksymalnie 3 przestrzenie robocze.");
        }
        return createInternal(userId, name.trim(), null, normalizeDescription(description));
    }

    private Workspace createInternal(UUID userId, String name, String preferredSlug, String description) {
        String slug = Slugifier.unique(
                preferredSlug == null ? name : preferredSlug,
                "workspace",
                80,
                candidate -> workspaces.existsBySlugIgnoreCaseAndDeletedAtIsNull(candidate));

        Workspace workspace = workspaces.save(new Workspace(userId, name, slug, description));
        members.save(new WorkspaceMember(workspace.getId(), userId, "OWNER", userId));
        return workspace;
    }

    private String normalizeDescription(String description) {
        if (description == null) return null;
        String trimmed = description.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
