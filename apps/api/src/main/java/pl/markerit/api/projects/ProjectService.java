package pl.markerit.api.projects;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.common.Slugifier;
import pl.markerit.api.projects.web.CreateProjectRequest;
import pl.markerit.api.projects.web.ProjectMemberResponse;
import pl.markerit.api.projects.web.ProjectResponse;
import pl.markerit.api.projects.web.UpdateProjectRequest;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceService;

@Service
public class ProjectService {

    public static final int MAX_PROJECTS_PER_WORKSPACE = 3;
    private static final Set<String> STATUSES = Set.of(
            Project.STATUS_ACTIVE, Project.STATUS_IN_REVIEW, Project.STATUS_CLOSED);
    private static final Set<String> TONES = Set.of("sage", "sand", "blue", "lilac", "emerald", "amber");

    private final ProjectRepository projects;
    private final UserRepository users;
    private final WorkspaceService workspaces;

    public ProjectService(ProjectRepository projects, UserRepository users, WorkspaceService workspaces) {
        this.projects = projects;
        this.users = users;
        this.workspaces = workspaces;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> list(UUID userId, UUID workspaceId) {
        workspaces.requireMember(workspaceId, userId);
        return projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(UUID userId, UUID projectId) {
        Project project = requireProject(projectId);
        workspaces.requireMember(project.getWorkspaceId(), userId);
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse create(UUID userId, UUID workspaceId, CreateProjectRequest request) {
        workspaces.requireProjectManager(workspaceId, userId);

        if (projects.countByWorkspaceIdAndDeletedAtIsNull(workspaceId) >= MAX_PROJECTS_PER_WORKSPACE) {
            throw new LimitReachedException(
                    "PROJECT_LIMIT_REACHED",
                    "Każda przestrzeń może mieć maksymalnie 3 projekty.");
        }

        String name = request.name().trim();
        String tone = request.tone() == null ? "sage" : request.tone();
        requireTone(tone);

        Project project = new Project(
                workspaceId,
                name,
                nextSlug(workspaceId, name),
                normalizeDescription(request.description()),
                tone,
                userId);

        return toResponse(projects.save(project));
    }

    @Transactional
    public ProjectResponse update(UUID userId, UUID projectId, UpdateProjectRequest request) {
        Project project = requireProject(projectId);
        WorkspaceMember member = workspaces.requireMember(project.getWorkspaceId(), userId);
        if (!member.canCreateProjects()) {
            throw new ForbiddenAccessException(
                    "PROJECT_FORBIDDEN",
                    "Twoja rola nie pozwala edytować projektów.");
        }

        String name = request.name() == null ? null : request.name().trim();
        String status = request.status() == null ? null : request.status().toUpperCase(Locale.ROOT);
        String tone = request.tone();
        if (status != null && !STATUSES.contains(status)) throwInvalidStatus();
        if (tone != null) requireTone(tone);

        project.update(
                name,
                request.description() == null ? null : normalizeDescription(request.description()),
                status,
                tone);

        return toResponse(projects.save(project));
    }

    @Transactional
    public void delete(UUID userId, UUID projectId) {
        Project project = requireProject(projectId);
        WorkspaceMember member = workspaces.requireMember(project.getWorkspaceId(), userId);
        if (!member.canEditWorkspace()) {
            throw new ForbiddenAccessException(
                    "PROJECT_FORBIDDEN",
                    "Tylko właściciel lub administrator przestrzeni może usunąć projekt.");
        }
        project.softDelete();
        projects.save(project);
    }

    @Transactional(readOnly = true)
    public Project requireProject(UUID projectId) {
        return projects.findByIdAndDeletedAtIsNull(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PROJECT_NOT_FOUND",
                        "Nie znaleziono projektu."));
    }

    private ProjectResponse toResponse(Project project) {
        User creator = project.getCreatedBy() == null
                ? null
                : users.findById(project.getCreatedBy()).orElse(null);
        String createdByName = creator == null ? "Usunięty użytkownik" : creator.getDisplayName();
        List<ProjectMemberResponse> members = creator == null
                ? List.of()
                : List.of(new ProjectMemberResponse(
                        creator.getId(),
                        creator.getDisplayName(),
                        initials(creator.getDisplayName())));

        return new ProjectResponse(
                project.getId(),
                project.getWorkspaceId(),
                project.getName(),
                project.getDescription(),
                project.getStatus(),
                project.getTone(),
                project.getCreatedBy(),
                createdByName,
                project.getCreatedAt(),
                project.getUpdatedAt(),
                0,
                members);
    }

    private String nextSlug(UUID workspaceId, String name) {
        return Slugifier.unique(
                name,
                "projekt",
                60,
                candidate -> projects.existsByWorkspaceIdAndSlugIgnoreCaseAndDeletedAtIsNull(workspaceId, candidate));
    }

    private void requireTone(String tone) {
        if (!TONES.contains(tone)) {
            throw new InvalidRequestException("INVALID_TONE", "Nieprawidłowy kolor projektu.");
        }
    }

    private void throwInvalidStatus() {
        throw new InvalidRequestException("INVALID_STATUS", "Nieprawidłowy status projektu.");
    }

    private String normalizeDescription(String description) {
        if (description == null) return null;
        String trimmed = description.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String initials(String displayName) {
        String[] parts = displayName.trim().split("\\s+");
        if (parts.length == 0 || parts[0].isBlank()) return "U";
        if (parts.length == 1) {
            String part = parts[0];
            return part.length() >= 2
                    ? part.substring(0, 2).toUpperCase(Locale.ROOT)
                    : part.substring(0, 1).toUpperCase(Locale.ROOT);
        }
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1))
                .toUpperCase(Locale.ROOT);
    }
}
