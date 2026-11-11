package pl.markerit.api.reviews;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.markerit.api.assets.Asset;
import pl.markerit.api.assets.AssetRepository;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.reviews.web.CreateReviewRequest;
import pl.markerit.api.reviews.web.CreateVersionRequest;
import pl.markerit.api.reviews.web.ReviewApprovalResponse;
import pl.markerit.api.reviews.web.ReviewApprovalSummaryResponse;
import pl.markerit.api.reviews.web.ReviewResponse;
import pl.markerit.api.reviews.web.ReviewReviewerResponse;
import pl.markerit.api.reviews.web.ReviewSummaryResponse;
import pl.markerit.api.reviews.web.ReviewVersionResponse;
import pl.markerit.api.reviews.web.SubmitApprovalRequest;
import pl.markerit.api.reviews.web.UpdateReviewRequest;
import pl.markerit.api.storage.AssetStorageResolver;
import pl.markerit.api.storage.StorageService;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceMemberRepository;
import pl.markerit.api.workspaces.WorkspaceService;

@Service
public class ReviewService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReviewService.class);
    private static final String UNKNOWN_USER = "Usunięty użytkownik";
    private static final Set<String> DECISIONS = Set.of(
            ReviewApproval.DECISION_APPROVED, ReviewApproval.DECISION_CHANGES_REQUESTED);

    private final ReviewRepository reviews;
    private final ReviewVersionRepository versions;
    private final ReviewVersionAssetRepository versionAssets;
    private final ReviewReviewerRepository reviewers;
    private final ReviewApprovalRepository approvals;
    private final ProjectService projects;
    private final WorkspaceService workspaces;
    private final WorkspaceMemberRepository workspaceMembers;
    private final UserRepository users;
    private final AssetRepository assets;
    private final AssetStorageResolver storages;

    public ReviewService(
            ReviewRepository reviews,
            ReviewVersionRepository versions,
            ReviewVersionAssetRepository versionAssets,
            ReviewReviewerRepository reviewers,
            ReviewApprovalRepository approvals,
            ProjectService projects,
            WorkspaceService workspaces,
            WorkspaceMemberRepository workspaceMembers,
            UserRepository users,
            AssetRepository assets,
            AssetStorageResolver storages) {
        this.reviews = reviews;
        this.versions = versions;
        this.versionAssets = versionAssets;
        this.reviewers = reviewers;
        this.approvals = approvals;
        this.projects = projects;
        this.workspaces = workspaces;
        this.workspaceMembers = workspaceMembers;
        this.users = users;
        this.assets = assets;
        this.storages = storages;
    }

    @Transactional(readOnly = true)
    public List<ReviewSummaryResponse> list(UUID userId, UUID projectId) {
        Project project = projects.requireProject(projectId);
        workspaces.requireMember(project.getWorkspaceId(), userId);
        return reviews.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(projectId).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public ReviewResponse create(UUID userId, UUID projectId, CreateReviewRequest request) {
        Project project = projects.requireProject(projectId);
        workspaces.requireProjectManager(project.getWorkspaceId(), userId);
        requireProjectOpen(project);

        Asset asset = requireVersionAsset(projectId, request.assetId());
        List<UUID> reviewerIds = validateReviewers(project.getWorkspaceId(), request.reviewerIds());
        String title = normalizeTitle(request.title());

        Review review = reviews.saveAndFlush(new Review(
                projectId,
                title,
                normalizeDescription(request.description()),
                userId));

        ReviewVersion version = versions.saveAndFlush(new ReviewVersion(
                review.getId(), 1, null, userId));
        versionAssets.save(new ReviewVersionAsset(version.getId(), asset.getId(), 0));

        for (UUID reviewerId : reviewerIds) {
            reviewers.save(new ReviewReviewer(review.getId(), reviewerId, userId));
        }

        return toResponse(review);
    }

    @Transactional(readOnly = true)
    public ReviewResponse get(UUID userId, UUID reviewId) {
        Review review = requireReview(reviewId);
        requireMember(review, userId);
        return toResponse(review);
    }

    @Transactional
    public ReviewResponse update(UUID userId, UUID reviewId, UpdateReviewRequest request) {
        Review review = requireReviewForUpdate(reviewId);
        requireWriteProject(review, userId);
        requireAuthor(review, userId);
        requireOpen(review);

        String title = request.title() == null ? null : normalizeTitle(request.title());
        String description = request.description() == null
                ? null
                : normalizeDescription(request.description());

        review.updateDetails(title, description, request.description() != null);

        if (request.reviewerIds() != null) {
            Project project = projects.requireProject(review.getProjectId());
            replaceReviewers(
                    review,
                    userId,
                    validateReviewers(project.getWorkspaceId(), request.reviewerIds()));
        }

        review.touch();
        reviews.save(review);
        return toResponse(review);
    }

    @Transactional
    public ReviewVersionResponse addVersion(UUID userId, UUID reviewId, CreateVersionRequest request) {
        Review review = requireReviewForUpdate(reviewId);
        Project project = requireWriteProject(review, userId);
        requireAuthor(review, userId);
        requireOpen(review);
        requireProjectOpen(project);

        Asset asset = requireVersionAsset(review.getProjectId(), request.assetId());
        int nextNumber = versions.findFirstByReviewIdOrderByVersionNumberDesc(reviewId)
                .map(latest -> latest.getVersionNumber() + 1)
                .orElse(1);

        ReviewVersion version = versions.saveAndFlush(new ReviewVersion(
                reviewId,
                nextNumber,
                normalizeNote(request.note()),
                userId));
        versionAssets.save(new ReviewVersionAsset(version.getId(), asset.getId(), 0));

        review.touch();
        reviews.save(review);

        return toVersionResponse(version);
    }

    @Transactional
    public ReviewApprovalResponse submitApproval(
            UUID userId,
            UUID reviewId,
            SubmitApprovalRequest request) {
        Review review = requireReviewForUpdate(reviewId);
        requireWriteProject(review, userId);
        requireReviewer(review, userId);
        requireOpen(review);

        ReviewVersion version = requireLatestVersion(reviewId);

        String decision = request.decision() == null
                ? ""
                : request.decision().trim().toUpperCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) {
            throw new InvalidRequestException(
                    "INVALID_DECISION",
                    "Decyzja musi być APPROVED lub CHANGES_REQUESTED.");
        }

        ReviewApproval approval = approvals.save(new ReviewApproval(
                reviewId,
                version.getId(),
                userId,
                decision,
                normalizeNote(request.note())));

        review.touch();
        reviews.save(review);

        return toApprovalResponse(approval);
    }

    @Transactional
    public ReviewResponse close(UUID userId, UUID reviewId) {
        Review review = requireReviewForUpdate(reviewId);
        requireWriteProject(review, userId);

        boolean author = isAuthor(review, userId);
        List<ReviewReviewer> assigned = reviewers.findForReview(reviewId);
        boolean reviewer = isReviewer(assigned, userId);
        if (!author && !reviewer) {
            throw forbidden("Tylko autor lub przypisany recenzent może zamknąć wątek recenzji.");
        }
        requireOpen(review);

        Map<UUID, ReviewApproval> latest = latestApprovals(reviewId);
        for (ReviewReviewer assignment : assigned) {
            ReviewApproval approval = effectiveApproval(assignment, latest);
            if (approval == null || !ReviewApproval.DECISION_APPROVED.equals(approval.getDecision())) {
                throw new ConflictException(
                        "REVIEW_NOT_APPROVED",
                        "Nie można zamknąć wątku, dopóki wszyscy przypisani recenzenci nie zatwierdzą najnowszej wersji.");
            }
        }

        review.close(userId);
        reviews.save(review);
        return toResponse(review);
    }

    /**
     * Permanently deletes the thread. Database cascades remove versions, pins,
     * comments, approvals and reviewer assignments. Review images that are not
     * referenced by any other version are deleted from the database and object
     * storage, which frees a slot in the project image limit.
     */
    @Transactional
    public void delete(UUID userId, UUID reviewId) {
        Review review = requireReviewForUpdate(reviewId);
        requireWriteProject(review, userId);

        boolean author = isAuthor(review, userId);
        boolean reviewer = isReviewer(reviewers.findForReview(reviewId), userId);
        if (!author && !reviewer) {
            throw forbidden("Tylko autor lub przypisany recenzent może usunąć wątek recenzji.");
        }

        List<ReviewVersion> threadVersions = versions.findByReviewIdOrderByVersionNumberAsc(reviewId);
        List<UUID> versionIds = threadVersions.stream().map(ReviewVersion::getId).toList();
        List<ReviewVersionAsset> links = versionIds.isEmpty()
                ? List.of()
                : versionAssets.findForVersions(versionIds);

        LinkedHashSet<UUID> assetIds = new LinkedHashSet<>();
        for (ReviewVersionAsset link : links) {
            assetIds.add(link.getAssetId());
        }

        Map<UUID, Asset> assetsToDelete = new LinkedHashMap<>();
        for (UUID assetId : assetIds) {
            assets.findByIdAndDeletedAtIsNull(assetId)
                    .ifPresent(asset -> assetsToDelete.put(assetId, asset));
        }

        reviews.delete(review);
        reviews.flush();

        List<Runnable> afterCommitDeletes = new ArrayList<>();
        for (Asset asset : assetsToDelete.values()) {
            if (versionAssets.countByAssetId(asset.getId()) > 0) {
                // Another thread still displays this image; keep the asset and its object.
                continue;
            }
            assets.delete(asset);
            StorageService storage = storages.forProvider(asset.getStorageProvider());
            afterCommitDeletes.add(() -> deleteStoredObject(storage, asset.getStorageKey()));
        }
        assets.flush();

        for (Runnable cleanup : afterCommitDeletes) {
            afterCommitOrNow(cleanup);
        }
    }

    private Review requireReview(UUID reviewId) {
        return reviews.findByIdAndDeletedAtIsNull(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "REVIEW_NOT_FOUND",
                        "Nie znaleziono wątku recenzji."));
    }

    private Review requireReviewForUpdate(UUID reviewId) {
        return reviews.findByIdForUpdate(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "REVIEW_NOT_FOUND",
                        "Nie znaleziono wątku recenzji."));
    }

    private void requireMember(Review review, UUID userId) {
        Project project = projects.requireProject(review.getProjectId());
        workspaces.requireMember(project.getWorkspaceId(), userId);
    }

    private Project requireWriteProject(Review review, UUID userId) {
        Project project = projects.requireProject(review.getProjectId());
        WorkspaceMember member = workspaces.requireMember(project.getWorkspaceId(), userId);
        if (!member.canWriteReviews()) {
            throw forbidden("Twoja rola w tej przestrzeni nie pozwala na edycję wątków recenzji.");
        }
        return project;
    }

    private void requireProjectOpen(Project project) {
        if (Project.STATUS_CLOSED.equals(project.getStatus())) {
            throw new ConflictException(
                    "PROJECT_CLOSED",
                    "Projekt jest zamknięty. Otwórz projekt, aby dodawać recenzje lub wersje.");
        }
    }

    private ReviewVersion requireLatestVersion(UUID reviewId) {
        return versions.findFirstByReviewIdOrderByVersionNumberDesc(reviewId)
                .orElseThrow(() -> new ConflictException(
                        "REVIEW_VERSION_MISSING",
                        "Wątek recenzji nie ma jeszcze żadnej wersji."));
    }

    private void requireAuthor(Review review, UUID userId) {
        if (!isAuthor(review, userId)) {
            throw forbidden("Tylko autor może edytować ten wątek recenzji.");
        }
    }

    private void requireReviewer(Review review, UUID userId) {
        if (!isReviewer(reviewers.findForReview(review.getId()), userId)) {
            throw forbidden("Tylko przypisany recenzent może oddać decyzję w tym wątku.");
        }
    }

    private void requireOpen(Review review) {
        if (review.isClosed()) {
            throw new ConflictException(
                    "REVIEW_CLOSED",
                    "Wątek recenzji jest zamknięty. Otwórz nowy wątek, aby wprowadzić zmiany.");
        }
    }

    private boolean isAuthor(Review review, UUID userId) {
        return userId != null && userId.equals(review.getCreatedBy());
    }

    private boolean isReviewer(List<ReviewReviewer> assigned, UUID userId) {
        return assigned.stream().anyMatch(reviewer -> userId.equals(reviewer.getUserId()));
    }

    private Asset requireVersionAsset(UUID projectId, UUID assetId) {
        if (assetId == null) {
            throw new InvalidRequestException(
                    "INVALID_VERSION_ASSET",
                    "Wybierz obraz do tej wersji recenzji.");
        }
        Asset asset = assets.findByIdAndDeletedAtIsNull(assetId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ASSET_NOT_FOUND",
                        "Nie znaleziono pliku."));
        if (!projectId.equals(asset.getProjectId())
                || !Asset.PURPOSE_REVIEW_IMAGE.equals(asset.getPurpose())
                || !Asset.STATUS_READY.equals(asset.getStatus())) {
            throw new InvalidRequestException(
                    "INVALID_VERSION_ASSET",
                    "Obraz musi należeć do tego projektu i być gotowym obrazem do recenzji.");
        }
        return asset;
    }

    private List<UUID> validateReviewers(UUID workspaceId, List<UUID> reviewerIds) {
        if (reviewerIds == null || reviewerIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<UUID> unique = new LinkedHashSet<>();
        for (UUID reviewerId : reviewerIds) {
            WorkspaceMember member = reviewerId == null
                    ? null
                    : workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, reviewerId).orElse(null);
            if (member == null) {
                throw new InvalidRequestException(
                        "INVALID_REVIEWER",
                        "Każdy recenzent musi należeć do przestrzeni roboczej projektu.");
            }
            if (!member.canWriteReviews()) {
                throw new InvalidRequestException(
                        "INVALID_REVIEWER_ROLE",
                        "Recenzent musi mieć rolę OWNER, ADMIN lub MEMBER w przestrzeni roboczej.");
            }
            unique.add(reviewerId);
        }
        return new ArrayList<>(unique);
    }

    private void replaceReviewers(Review review, UUID userId, List<UUID> desiredIds) {
        LinkedHashSet<UUID> desired = new LinkedHashSet<>(desiredIds);
        List<ReviewReviewer> current = reviewers.findForReview(review.getId());
        LinkedHashSet<UUID> currentIds = new LinkedHashSet<>();
        for (ReviewReviewer assignment : current) {
            currentIds.add(assignment.getUserId());
            if (!desired.contains(assignment.getUserId())) {
                reviewers.delete(assignment);
            }
        }
        for (UUID reviewerId : desired) {
            if (!currentIds.contains(reviewerId)) {
                reviewers.save(new ReviewReviewer(review.getId(), reviewerId, userId));
            }
        }
    }

    private ReviewSummaryResponse toSummary(Review review) {
        List<ReviewReviewer> assigned = reviewers.findForReview(review.getId());
        Map<UUID, ReviewApproval> latest = latestApprovals(review.getId());
        return toSummary(review, assigned, latest);
    }

    private ReviewSummaryResponse toSummary(
            Review review,
            List<ReviewReviewer> assigned,
            Map<UUID, ReviewApproval> latest) {
        ReviewVersionResponse latestVersion = versions
                .findFirstByReviewIdOrderByVersionNumberDesc(review.getId())
                .map(this::toVersionResponse)
                .orElse(null);

        return new ReviewSummaryResponse(
                review.getId(),
                review.getProjectId(),
                review.getTitle(),
                review.getDescription(),
                review.getStatus(),
                review.getCreatedBy(),
                displayName(review.getCreatedBy()),
                review.getCreatedAt(),
                review.getUpdatedAt(),
                review.getClosedAt(),
                review.getClosedBy(),
                review.getClosedBy() == null ? null : displayName(review.getClosedBy()),
                latestVersion,
                assigned.size(),
                approvalSummary(assigned, latest));
    }

    private ReviewResponse toResponse(Review review) {
        List<ReviewReviewer> assigned = reviewers.findForReview(review.getId());
        Map<UUID, ReviewApproval> latest = latestApprovals(review.getId());

        List<ReviewVersionResponse> versionResponses = versions
                .findByReviewIdOrderByVersionNumberAsc(review.getId()).stream()
                .map(this::toVersionResponse)
                .toList();

        List<ReviewReviewerResponse> reviewerResponses = assigned.stream()
                .map(assignment -> toReviewerResponse(
                        assignment, effectiveApproval(assignment, latest)))
                .toList();

        List<ReviewApprovalResponse> approvalResponses = latest.values().stream()
                .sorted(Comparator.comparing(ReviewApproval::getCreatedAt)
                        .thenComparing(ReviewApproval::getId))
                .map(this::toApprovalResponse)
                .toList();

        return new ReviewResponse(
                toSummary(review, assigned, latest),
                reviewerResponses,
                versionResponses,
                approvalResponses);
    }

    private ReviewReviewerResponse toReviewerResponse(ReviewReviewer assignment, ReviewApproval approval) {
        UUID reviewerId = assignment.getUserId();
        String displayName = displayName(reviewerId);
        return new ReviewReviewerResponse(
                reviewerId,
                displayName,
                initials(displayName),
                approval == null ? null : approval.getDecision(),
                approval == null ? null : approval.getNote(),
                approval == null ? null : approval.getCreatedAt());
    }

    private ReviewVersionResponse toVersionResponse(ReviewVersion version) {
        List<ReviewVersionAsset> links = versionAssets.findForVersion(version.getId());
        AssetResponse assetResponse = links.isEmpty()
                ? null
                : assets.findByIdAndDeletedAtIsNull(links.getFirst().getAssetId())
                        .map(this::toAssetResponse)
                        .orElse(null);
        return new ReviewVersionResponse(
                version.getId(),
                version.getVersionNumber(),
                version.getNote(),
                assetResponse,
                version.getCreatedAt(),
                displayName(version.getCreatedBy()));
    }

    private ReviewApprovalResponse toApprovalResponse(ReviewApproval approval) {
        return new ReviewApprovalResponse(
                approval.getUserId(),
                displayName(approval.getUserId()),
                approval.getReviewVersionId(),
                approval.getDecision(),
                approval.getNote(),
                approval.getCreatedAt());
    }

    private ReviewApprovalSummaryResponse approvalSummary(
            List<ReviewReviewer> assigned,
            Map<UUID, ReviewApproval> latest) {
        int approved = 0;
        int changesRequested = 0;
        for (ReviewReviewer assignment : assigned) {
            ReviewApproval approval = effectiveApproval(assignment, latest);
            if (approval == null) {
                continue;
            }
            if (ReviewApproval.DECISION_APPROVED.equals(approval.getDecision())) {
                approved++;
            } else if (ReviewApproval.DECISION_CHANGES_REQUESTED.equals(approval.getDecision())) {
                changesRequested++;
            }
        }
        int total = assigned.size();
        return new ReviewApprovalSummaryResponse(
                approved,
                changesRequested,
                total - approved - changesRequested,
                total);
    }

    /** Returns the latest decision per user for the review's newest version. */
    private Map<UUID, ReviewApproval> latestApprovals(UUID reviewId) {
        return versions.findFirstByReviewIdOrderByVersionNumberDesc(reviewId)
                .map(version -> latestApprovals(reviewId, version.getId()))
                .orElseGet(LinkedHashMap::new);
    }

    private Map<UUID, ReviewApproval> latestApprovals(UUID reviewId, UUID reviewVersionId) {
        Map<UUID, ReviewApproval> latest = new LinkedHashMap<>();
        for (ReviewApproval approval : approvals.findNewestFirst(reviewId, reviewVersionId)) {
            latest.putIfAbsent(approval.getUserId(), approval);
        }
        return latest;
    }

    /**
     * A decision only counts for the current assignment. Re-adding a reviewer
     * starts a new generation, so decisions made before {@code created_at} of
     * the current assignment are ignored.
     */
    private ReviewApproval effectiveApproval(
            ReviewReviewer assignment,
            Map<UUID, ReviewApproval> latest) {
        ReviewApproval approval = latest.get(assignment.getUserId());
        if (approval == null || approval.getCreatedAt().isBefore(assignment.getCreatedAt())) {
            return null;
        }
        return approval;
    }

    private String displayName(UUID userId) {
        if (userId == null) return UNKNOWN_USER;
        return users.findById(userId)
                .map(User::getDisplayName)
                .orElse(UNKNOWN_USER);
    }

    private String normalizeTitle(String title) {
        String trimmed = title == null ? "" : title.trim();
        if (trimmed.isEmpty()) {
            throw new InvalidRequestException(
                    "INVALID_TITLE",
                    "Tytuł recenzji nie może być pusty.");
        }
        return trimmed;
    }

    private String normalizeDescription(String description) {
        if (description == null) return null;
        String trimmed = description.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeNote(String note) {
        if (note == null) return null;
        String trimmed = note.trim();
        return trimmed.isEmpty() ? null : trimmed;
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

    private ForbiddenAccessException forbidden(String message) {
        return new ForbiddenAccessException("REVIEW_FORBIDDEN", message);
    }

    private void afterCommitOrNow(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private void deleteStoredObject(StorageService storage, String storageKey) {
        try {
            storage.deleteObject(storageKey);
        } catch (RuntimeException exception) {
            // The database transaction has already committed. A storage failure
            // must not turn a successful delete into a 500; log it for cleanup.
            LOGGER.warn(
                    "Nie udało się usunąć pliku {} z magazynu po usunięciu recenzji. "
                            + "Obiekt wymaga ręcznego czyszczenia.",
                    storageKey,
                    exception);
        }
    }
}
