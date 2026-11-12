package pl.markerit.api.feedback;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.assets.Asset;
import pl.markerit.api.assets.AssetRepository;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.feedback.web.WorkspaceFeedbackResponse;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectRepository;
import pl.markerit.api.reviews.Review;
import pl.markerit.api.reviews.ReviewRepository;
import pl.markerit.api.reviews.ReviewVersion;
import pl.markerit.api.reviews.ReviewVersionRepository;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceService;

/**
 * Read model behind the workspace feedback inbox.
 *
 * <p>The inbox collects pins from the latest version of every review that
 * belongs to the workspace, across all of its projects. Only visible pins and
 * comments are included. The response is sorted by the most recent activity so
 * the freshest feedback appears first.</p>
 */
@Service
public class WorkspaceFeedbackService {

    private static final String UNKNOWN_USER = "Usunięty użytkownik";

    private final WorkspaceService workspaces;
    private final ProjectRepository projects;
    private final ReviewRepository reviews;
    private final ReviewVersionRepository versions;
    private final PinRepository pins;
    private final PinCommentRepository comments;
    private final UserRepository users;
    private final AssetRepository assets;

    public WorkspaceFeedbackService(
            WorkspaceService workspaces,
            ProjectRepository projects,
            ReviewRepository reviews,
            ReviewVersionRepository versions,
            PinRepository pins,
            PinCommentRepository comments,
            UserRepository users,
            AssetRepository assets) {
        this.workspaces = workspaces;
        this.projects = projects;
        this.reviews = reviews;
        this.versions = versions;
        this.pins = pins;
        this.comments = comments;
        this.users = users;
        this.assets = assets;
    }

    @Transactional(readOnly = true)
    public List<WorkspaceFeedbackResponse> list(UUID userId, UUID workspaceId) {
        workspaces.requireMember(workspaceId, userId);

        List<Project> workspaceProjects =
                projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId);
        if (workspaceProjects.isEmpty()) {
            return List.of();
        }

        Map<UUID, Project> projectsById = new HashMap<>();
        for (Project project : workspaceProjects) {
            projectsById.put(project.getId(), project);
        }

        List<Review> workspaceReviews = reviews
                .findByProjectIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(projectsById.keySet());
        if (workspaceReviews.isEmpty()) {
            return List.of();
        }

        Map<UUID, Review> reviewsById = new HashMap<>();
        for (Review review : workspaceReviews) {
            reviewsById.put(review.getId(), review);
        }

        Map<UUID, ReviewVersion> latestVersions = latestVersions(reviewsById.keySet());
        if (latestVersions.isEmpty()) {
            return List.of();
        }

        Set<UUID> latestVersionIds = new LinkedHashSet<>();
        Map<UUID, ReviewVersion> versionsById = new HashMap<>();
        for (ReviewVersion version : latestVersions.values()) {
            latestVersionIds.add(version.getId());
            versionsById.put(version.getId(), version);
        }
        List<Pin> latestPins = pins
                .findByReviewVersionIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                        latestVersionIds);
        if (latestPins.isEmpty()) {
            return List.of();
        }

        List<UUID> pinIds = latestPins.stream().map(Pin::getId).toList();
        List<PinComment> visibleComments =
                comments.findByPinIdInAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(pinIds);
        Map<UUID, List<PinComment>> commentsByPin = groupComments(visibleComments);

        Map<UUID, Asset> assetsById = loadAssets(latestPins);
        Map<UUID, User> usersById = loadUsers(latestPins, visibleComments);

        List<WorkspaceFeedbackResponse> result = new ArrayList<>(latestPins.size());
        for (Pin pin : latestPins) {
            ReviewVersion version = versionsById.get(pin.getReviewVersionId());
            if (version == null) {
                continue;
            }
            Review review = reviewsById.get(version.getReviewId());
            if (review == null) {
                continue;
            }
            Project project = projectsById.get(review.getProjectId());
            if (project == null) {
                continue;
            }

            List<PinComment> thread = commentsByPin.getOrDefault(pin.getId(), List.of());
            PinComment lastComment = thread.isEmpty() ? null : thread.getLast();
            Asset asset = assetsById.get(pin.getAssetId());

            String authorName = displayName(pin.getCreatedBy(), usersById);
            String lastAuthorName = lastComment == null
                    ? null
                    : displayName(lastComment.getAuthorId(), usersById);

            result.add(new WorkspaceFeedbackResponse(
                    pin.getId(),
                    project.getId(),
                    project.getName(),
                    project.getTone(),
                    review.getId(),
                    review.getTitle(),
                    review.getStatus(),
                    version.getId(),
                    version.getVersionNumber(),
                    asset == null ? null : toAssetResponse(asset),
                    pin.getXPercent(),
                    pin.getYPercent(),
                    pin.getStatus(),
                    pin.getCreatedBy(),
                    authorName,
                    initials(authorName),
                    pin.getCreatedAt(),
                    pin.getResolvedBy(),
                    pin.getResolvedBy() == null ? null : displayName(pin.getResolvedBy(), usersById),
                    pin.getResolvedAt(),
                    thread.size(),
                    lastComment == null ? null : lastComment.getBody(),
                    lastAuthorName,
                    lastAuthorName == null ? null : initials(lastAuthorName),
                    lastComment == null ? null : lastComment.getCreatedAt()));
        }

        return result.stream()
                .sorted(Comparator.comparing(this::lastActivityAt)
                        .reversed()
                        .thenComparing(WorkspaceFeedbackResponse::id))
                .toList();
    }

    private Map<UUID, ReviewVersion> latestVersions(Set<UUID> reviewIds) {
        List<ReviewVersion> found =
                versions.findByReviewIdInOrderByReviewIdAscVersionNumberAsc(reviewIds);
        Map<UUID, ReviewVersion> latest = new HashMap<>();
        for (ReviewVersion version : found) {
            latest.merge(
                    version.getReviewId(),
                    version,
                    (current, candidate) -> candidate.getVersionNumber() > current.getVersionNumber()
                            ? candidate
                            : current);
        }
        return latest;
    }

    private Map<UUID, List<PinComment>> groupComments(List<PinComment> found) {
        Map<UUID, List<PinComment>> grouped = new HashMap<>();
        for (PinComment comment : found) {
            grouped.computeIfAbsent(comment.getPinId(), ignored -> new ArrayList<>()).add(comment);
        }
        return grouped;
    }

    private Map<UUID, Asset> loadAssets(List<Pin> latestPins) {
        Set<UUID> assetIds = new LinkedHashSet<>();
        for (Pin pin : latestPins) {
            assetIds.add(pin.getAssetId());
        }
        Map<UUID, Asset> found = new HashMap<>();
        for (Asset asset : assets.findAllById(assetIds)) {
            if (asset.getDeletedAt() == null) {
                found.put(asset.getId(), asset);
            }
        }
        return found;
    }

    private Map<UUID, User> loadUsers(List<Pin> latestPins, List<PinComment> visibleComments) {
        Set<UUID> userIds = new LinkedHashSet<>();
        for (Pin pin : latestPins) {
            addIfPresent(userIds, pin.getCreatedBy());
            addIfPresent(userIds, pin.getResolvedBy());
        }
        for (PinComment comment : visibleComments) {
            addIfPresent(userIds, comment.getAuthorId());
        }
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, User> found = new HashMap<>();
        for (User user : users.findAllById(userIds)) {
            found.put(user.getId(), user);
        }
        return found;
    }

    private Instant lastActivityAt(WorkspaceFeedbackResponse item) {
        Instant activity = item.lastCommentAt() == null ? item.createdAt() : item.lastCommentAt();
        if (item.resolvedAt() != null && item.resolvedAt().isAfter(activity)) {
            return item.resolvedAt();
        }
        return activity;
    }

    private AssetResponse toAssetResponse(Asset asset) {
        return new AssetResponse(
                asset.getId(),
                asset.getProjectId(),
                asset.getPurpose(),
                asset.getContentType(),
                asset.getOriginalName(),
                asset.getSizeBytes(),
                asset.getWidth(),
                asset.getHeight(),
                "assets/" + asset.getId() + "/content",
                asset.getCreatedAt());
    }

    private String displayName(UUID userId, Map<UUID, User> usersById) {
        if (userId == null) {
            return UNKNOWN_USER;
        }
        User user = usersById.get(userId);
        return user == null ? UNKNOWN_USER : user.getDisplayName();
    }

    private static void addIfPresent(Set<UUID> ids, UUID id) {
        if (id != null) {
            ids.add(id);
        }
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
