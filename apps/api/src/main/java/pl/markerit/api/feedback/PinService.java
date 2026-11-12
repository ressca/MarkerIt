package pl.markerit.api.feedback;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
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
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.feedback.web.CommentResponse;
import pl.markerit.api.feedback.web.CreateCommentRequest;
import pl.markerit.api.feedback.web.CreatePinRequest;
import pl.markerit.api.feedback.web.DiscussionPinResponse;
import pl.markerit.api.feedback.web.DiscussionResponse;
import pl.markerit.api.feedback.web.DiscussionReviewResponse;
import pl.markerit.api.feedback.web.PinResponse;
import pl.markerit.api.feedback.web.UpdateCommentRequest;
import pl.markerit.api.feedback.web.UpdatePinRequest;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.realtime.ReviewRealtimePublisher;
import pl.markerit.api.reviews.Review;
import pl.markerit.api.reviews.ReviewApproval;
import pl.markerit.api.reviews.ReviewApprovalRepository;
import pl.markerit.api.reviews.ReviewRepository;
import pl.markerit.api.reviews.ReviewVersion;
import pl.markerit.api.reviews.ReviewVersionAsset;
import pl.markerit.api.reviews.ReviewVersionAssetRepository;
import pl.markerit.api.reviews.ReviewVersionRepository;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceService;

/**
 * Pins, comments and the per-version discussion feed.
 *
 * <p>All reads require workspace membership. Any workspace member (including
 * VIEWER) may create pins and comments while the review is OPEN. Editing a
 * comment is limited to its author; deleting a pin or comment is allowed for
 * its author or a workspace ADMIN/OWNER. Reading and moderation remain possible
 * after the review is closed, but new pins and comments are rejected.</p>
 *
 * <p>Pin status policy is intentionally unchanged: any workspace member may
 * resolve or reopen a pin (not only its author or an administrator).</p>
 */
@Service
public class PinService {

    private static final String UNKNOWN_USER = "Usunięty użytkownik";
    private static final int MAX_ATTACHMENTS = 10;
    private static final int MAX_COMMENT_DEPTH = 3;
    private static final Set<String> PIN_STATUSES =
            Set.of(Pin.STATUS_OPEN, Pin.STATUS_RESOLVED);

    private final PinRepository pins;
    private final PinCommentRepository comments;
    private final PinCommentAttachmentRepository attachments;
    private final ReviewRepository reviews;
    private final ReviewVersionRepository versions;
    private final ReviewVersionAssetRepository versionAssets;
    private final ReviewApprovalRepository approvals;
    private final ProjectService projects;
    private final WorkspaceService workspaces;
    private final UserRepository users;
    private final AssetRepository assets;
    private final ReviewRealtimePublisher realtime;

    public PinService(
            PinRepository pins,
            PinCommentRepository comments,
            PinCommentAttachmentRepository attachments,
            ReviewRepository reviews,
            ReviewVersionRepository versions,
            ReviewVersionAssetRepository versionAssets,
            ReviewApprovalRepository approvals,
            ProjectService projects,
            WorkspaceService workspaces,
            UserRepository users,
            AssetRepository assets,
            ReviewRealtimePublisher realtime) {
        this.pins = pins;
        this.comments = comments;
        this.attachments = attachments;
        this.reviews = reviews;
        this.versions = versions;
        this.versionAssets = versionAssets;
        this.approvals = approvals;
        this.projects = projects;
        this.workspaces = workspaces;
        this.users = users;
        this.assets = assets;
        this.realtime = realtime;
    }

    @Transactional(readOnly = true)
    public List<PinResponse> listPins(UUID userId, UUID reviewId, UUID versionId) {
        Review review = requireReview(reviewId);
        requireMember(review, userId);
        ReviewVersion version = requireVersion(reviewId, versionId);

        List<Pin> found = pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(
                version.getId());
        List<PinComment> thread = commentsForPins(found.stream().map(Pin::getId).toList());
        Map<UUID, User> usersById = loadUsers(userIds(found, thread, List.of()));
        Map<UUID, List<CommentResponse>> commentsByPin = commentsByPin(thread, usersById);
        return found.stream()
                .map(pin -> toPinResponse(
                        pin, commentsByPin.getOrDefault(pin.getId(), List.of()), usersById))
                .toList();
    }

    @Transactional
    public PinResponse createPin(
            UUID userId,
            UUID reviewId,
            UUID versionId,
            CreatePinRequest request) {
        // Lock the review row so a concurrent close cannot interleave between
        // the OPEN check and inserting the pin/comment.
        Review review = requireReviewForUpdate(reviewId);
        requireMember(review, userId);
        requireOpen(review);
        ReviewVersion version = requireVersion(reviewId, versionId);

        UUID assetId = requireVersionImage(version.getId());
        double xPercent = requireCoordinate(request.xPercent());
        double yPercent = requireCoordinate(request.yPercent());
        String body = requireBody(request.body());
        List<Asset> attachmentAssets = requireAttachments(
                review.getProjectId(), request.attachmentAssetIds());

        Pin pin = pins.saveAndFlush(new Pin(
                version.getId(), assetId, xPercent, yPercent, userId));
        PinComment firstComment = comments.saveAndFlush(new PinComment(
                pin.getId(), null, userId, body));
        saveAttachments(firstComment.getId(), attachmentAssets);

        List<AssetResponse> attachmentResponses = attachmentAssets.stream()
                .map(this::toAssetResponse)
                .toList();
        Map<UUID, User> usersById = loadUsers(Set.of(userId));
        PinResponse response = toPinResponse(
                pin,
                List.of(toCommentResponse(firstComment, attachmentResponses, usersById)),
                usersById);
        realtime.pinCreated(review.getProjectId(), review.getId(), version.getId(), response);
        return response;
    }

    @Transactional
    public PinResponse updatePin(UUID userId, UUID pinId, UpdatePinRequest request) {
        Pin pin = requirePin(pinId);
        Review review = requireReviewForPin(pin);
        requireMember(review, userId);

        String status = request.status() == null
                ? ""
                : request.status().trim().toUpperCase(Locale.ROOT);
        if (!PIN_STATUSES.contains(status)) {
            throw new InvalidRequestException(
                    "INVALID_PIN_STATUS",
                    "Status pinezki musi mieć wartość OPEN lub RESOLVED.");
        }
        if (Pin.STATUS_RESOLVED.equals(status)) {
            if (!pin.isResolved()) {
                pin.resolve(userId);
            }
        } else {
            pin.reopen();
        }
        pins.save(pin);

        List<PinComment> thread = commentsForPins(List.of(pin.getId()));
        Map<UUID, User> usersById = loadUsers(userIds(List.of(pin), thread, List.of()));
        PinResponse response = toPinResponse(
                pin,
                commentsByPin(thread, usersById).getOrDefault(pin.getId(), List.of()),
                usersById);
        realtime.pinUpdated(
                review.getProjectId(), review.getId(), pin.getReviewVersionId(), response);
        return response;
    }

    @Transactional
    public void deletePin(UUID userId, UUID pinId) {
        Pin pin = requirePin(pinId);
        Review review = requireReviewForPin(pin);
        WorkspaceMember member = requireMember(review, userId);
        requireAuthorOrAdmin(pin.getCreatedBy(), member);

        pin.softDelete();
        pins.save(pin);
        List<PinComment> thread = comments.findByPinIdAndDeletedAtIsNull(pinId);
        for (PinComment comment : thread) {
            comment.softDelete();
        }
        comments.saveAll(thread);

        realtime.pinDeleted(
                review.getProjectId(), review.getId(), pin.getReviewVersionId(), pinId);
    }

    @Transactional
    public CommentResponse addComment(UUID userId, UUID pinId, CreateCommentRequest request) {
        Pin pin = requirePin(pinId);
        // Lock the review row before checking status so a concurrent close
        // cannot pass the OPEN check while this comment is inserted.
        Review review = requireReviewForUpdateForPin(pin);
        requireMember(review, userId);
        requireOpen(review);

        String body = requireBody(request.body());
        requireParentComment(pin, request.parentCommentId());
        List<Asset> attachmentAssets = requireAttachments(
                review.getProjectId(), request.attachmentAssetIds());

        PinComment comment = comments.saveAndFlush(new PinComment(
                pin.getId(), request.parentCommentId(), userId, body));
        saveAttachments(comment.getId(), attachmentAssets);

        List<AssetResponse> attachmentResponses = attachmentAssets.stream()
                .map(this::toAssetResponse)
                .toList();
        Map<UUID, User> usersById = loadUsers(Set.of(userId));
        CommentResponse response = toCommentResponse(comment, attachmentResponses, usersById);
        realtime.commentCreated(
                review.getProjectId(), review.getId(), pin.getReviewVersionId(),
                pin.getId(), response);
        return response;
    }

    @Transactional
    public CommentResponse updateComment(
            UUID userId,
            UUID commentId,
            UpdateCommentRequest request) {
        PinComment comment = requireComment(commentId);
        Pin pin = requirePin(comment.getPinId());
        Review review = requireReviewForPin(pin);
        requireMember(review, userId);
        if (comment.getAuthorId() == null || !comment.getAuthorId().equals(userId)) {
            throw new ForbiddenAccessException(
                    "COMMENT_FORBIDDEN",
                    "Tylko autor może edytować ten komentarz.");
        }

        comment.edit(requireBody(request.body()));
        comments.saveAndFlush(comment);

        Map<UUID, User> usersById = loadUsers(Set.of(comment.getAuthorId() == null
                ? userId
                : comment.getAuthorId()));
        CommentResponse response = toCommentResponse(comment, usersById);
        realtime.commentUpdated(
                review.getProjectId(), review.getId(), pin.getReviewVersionId(),
                pin.getId(), response);
        return response;
    }

    @Transactional
    public void deleteComment(UUID userId, UUID commentId) {
        PinComment comment = requireComment(commentId);
        Pin pin = requirePin(comment.getPinId());
        Review review = requireReviewForPin(pin);
        WorkspaceMember member = requireMember(review, userId);
        requireAuthorOrAdmin(comment.getAuthorId(), member);

        comment.softDelete();
        comments.saveAndFlush(comment);

        // Publish a tombstone instead of a bare id: replies stay attached to a
        // visible, redacted parent in every connected discussion feed.
        Map<UUID, User> usersById = loadUsers(Set.of(comment.getAuthorId() == null
                ? userId
                : comment.getAuthorId()));
        CommentResponse tombstone = toCommentResponse(comment, usersById);
        realtime.commentDeleted(
                review.getProjectId(), review.getId(), pin.getReviewVersionId(),
                pin.getId(), tombstone);
    }

    @Transactional(readOnly = true)
    public DiscussionResponse discussion(UUID userId, UUID reviewId, UUID versionId) {
        Review review = requireReview(reviewId);
        requireMember(review, userId);
        ReviewVersion version = requireVersion(reviewId, versionId);

        List<Pin> found = pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(
                version.getId());
        List<PinComment> thread = commentsForPins(found.stream().map(Pin::getId).toList());
        List<ReviewApproval> versionApprovals = approvals.findNewestFirst(reviewId, version.getId());
        Map<UUID, User> usersById = loadUsers(userIds(found, thread, versionApprovals));
        Map<UUID, List<CommentResponse>> commentsByPin = commentsByPin(thread, usersById);

        List<DiscussionPinResponse> pinResponses = found.stream()
                .map(pin -> toDiscussionPin(
                        pin,
                        // Count only visible comments; deleted comments are
                        // tombstones kept for tree integrity.
                        (int) commentsByPin.getOrDefault(pin.getId(), List.of()).stream()
                                .filter(comment -> !comment.deleted())
                                .count(),
                        usersById))
                .toList();

        List<CommentResponse> flatComments = commentsByPin.values().stream()
                .flatMap(List::stream)
                .sorted(Comparator.comparing(CommentResponse::createdAt)
                        .thenComparing(CommentResponse::id))
                .toList();

        List<DiscussionReviewResponse> reviewComments = new ArrayList<>();
        for (int index = versionApprovals.size() - 1; index >= 0; index--) {
            ReviewApproval approval = versionApprovals.get(index);
            String name = displayName(approval.getUserId(), usersById);
            reviewComments.add(new DiscussionReviewResponse(
                    approval.getId(),
                    approval.getReviewId(),
                    approval.getReviewVersionId(),
                    "REVIEW",
                    approval.getDecision(),
                    approval.getNote(),
                    approval.getUserId(),
                    name,
                    initials(name),
                    approval.getCreatedAt()));
        }

        return new DiscussionResponse(
                review.getId(),
                version.getId(),
                pinResponses,
                flatComments,
                reviewComments);
    }

    private List<PinComment> commentsForPins(List<UUID> pinIds) {
        if (pinIds.isEmpty()) {
            return List.of();
        }
        // Deleted comments are returned as tombstones so replies keep their
        // parent in the tree; the response layer redacts them.
        return comments.findByPinIdInOrderByCreatedAtAscIdAsc(pinIds);
    }

    private Map<UUID, List<CommentResponse>> commentsByPin(
            List<PinComment> found, Map<UUID, User> usersById) {
        List<UUID> visibleCommentIds = found.stream()
                .filter(comment -> !comment.isDeleted())
                .map(PinComment::getId)
                .toList();
        Map<UUID, List<AssetResponse>> assetsByComment = attachmentsForComments(visibleCommentIds);

        Map<UUID, List<CommentResponse>> grouped = new HashMap<>();
        for (PinComment comment : found) {
            CommentResponse response = toCommentResponse(
                    comment,
                    assetsByComment.getOrDefault(comment.getId(), List.of()),
                    usersById);
            grouped.computeIfAbsent(comment.getPinId(), ignored -> new ArrayList<>()).add(response);
        }
        return grouped;
    }

    private Map<UUID, List<AssetResponse>> attachmentsForComments(List<UUID> commentIds) {
        if (commentIds.isEmpty()) {
            return Map.of();
        }
        List<PinCommentAttachment> links = attachments
                .findByIdPinCommentIdInOrderByIdPinCommentIdAscPositionAsc(commentIds);
        if (links.isEmpty()) {
            return Map.of();
        }
        Set<UUID> assetIds = new LinkedHashSet<>();
        for (PinCommentAttachment link : links) {
            assetIds.add(link.getAssetId());
        }
        Map<UUID, Asset> found = new HashMap<>();
        for (Asset asset : assets.findAllById(assetIds)) {
            if (asset.getDeletedAt() == null) {
                found.put(asset.getId(), asset);
            }
        }
        Map<UUID, List<AssetResponse>> grouped = new HashMap<>();
        for (PinCommentAttachment link : links) {
            Asset asset = found.get(link.getAssetId());
            if (asset == null) {
                continue;
            }
            grouped.computeIfAbsent(link.getPinCommentId(), ignored -> new ArrayList<>())
                    .add(toAssetResponse(asset));
        }
        return grouped;
    }

    private PinResponse toPinResponse(
            Pin pin, List<CommentResponse> commentResponses, Map<UUID, User> usersById) {
        String name = displayName(pin.getCreatedBy(), usersById);
        String resolvedByName = pin.getResolvedBy() == null
                ? null
                : displayName(pin.getResolvedBy(), usersById);
        return new PinResponse(
                pin.getId(),
                pin.getReviewVersionId(),
                pin.getAssetId(),
                pin.getXPercent(),
                pin.getYPercent(),
                pin.getStatus(),
                pin.getCreatedBy(),
                name,
                initials(name),
                pin.getCreatedAt(),
                pin.getResolvedBy(),
                resolvedByName,
                pin.getResolvedAt(),
                commentResponses);
    }

    private DiscussionPinResponse toDiscussionPin(
            Pin pin, int commentCount, Map<UUID, User> usersById) {
        String name = displayName(pin.getCreatedBy(), usersById);
        String resolvedByName = pin.getResolvedBy() == null
                ? null
                : displayName(pin.getResolvedBy(), usersById);
        return new DiscussionPinResponse(
                pin.getId(),
                pin.getAssetId(),
                pin.getXPercent(),
                pin.getYPercent(),
                pin.getStatus(),
                pin.getCreatedBy(),
                name,
                initials(name),
                pin.getCreatedAt(),
                pin.getResolvedBy(),
                resolvedByName,
                pin.getResolvedAt(),
                commentCount);
    }

    private CommentResponse toCommentResponse(PinComment comment, Map<UUID, User> usersById) {
        List<AssetResponse> attachmentResponses = comment.isDeleted()
                ? List.of()
                : attachmentsForComments(List.of(comment.getId()))
                        .getOrDefault(comment.getId(), List.of());
        return toCommentResponse(comment, attachmentResponses, usersById);
    }

    private CommentResponse toCommentResponse(
            PinComment comment,
            List<AssetResponse> attachmentResponses,
            Map<UUID, User> usersById) {
        String name = displayName(comment.getAuthorId(), usersById);
        boolean deleted = comment.isDeleted();
        return new CommentResponse(
                comment.getId(),
                comment.getPinId(),
                comment.getParentCommentId(),
                comment.getAuthorId(),
                name,
                initials(name),
                // Tombstones keep their position in the thread but never leak
                // the original body or attachments.
                deleted ? "" : comment.getBody(),
                comment.getCreatedAt(),
                comment.getUpdatedAt(),
                comment.getEditedAt(),
                deleted,
                deleted ? List.of() : attachmentResponses);
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

    private Review requireReviewForPin(Pin pin) {
        return versions.findById(pin.getReviewVersionId())
                .map(version -> requireReview(version.getReviewId()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PIN_NOT_FOUND",
                        "Nie znaleziono pinezki."));
    }

    private Review requireReviewForUpdateForPin(Pin pin) {
        return versions.findById(pin.getReviewVersionId())
                .map(version -> requireReviewForUpdate(version.getReviewId()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PIN_NOT_FOUND",
                        "Nie znaleziono pinezki."));
    }

    private ReviewVersion requireVersion(UUID reviewId, UUID versionId) {
        return versions.findById(versionId)
                .filter(version -> reviewId.equals(version.getReviewId()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "VERSION_NOT_FOUND",
                        "Nie znaleziono wersji recenzji."));
    }

    private UUID requireVersionImage(UUID versionId) {
        List<ReviewVersionAsset> links = versionAssets.findForVersion(versionId);
        if (links.isEmpty()) {
            throw new InvalidRequestException(
                    "VERSION_ASSET_MISSING",
                    "Ta wersja recenzji nie ma obrazu, na którym można dodać pinezkę.");
        }
        return links.getFirst().getAssetId();
    }

    private Pin requirePin(UUID pinId) {
        return pins.findByIdAndDeletedAtIsNull(pinId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PIN_NOT_FOUND",
                        "Nie znaleziono pinezki."));
    }

    private PinComment requireComment(UUID commentId) {
        return comments.findByIdAndDeletedAtIsNull(commentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "COMMENT_NOT_FOUND",
                        "Nie znaleziono komentarza."));
    }

    private WorkspaceMember requireMember(Review review, UUID userId) {
        Project project = projects.requireProject(review.getProjectId());
        return workspaces.requireMember(project.getWorkspaceId(), userId);
    }

    private void requireOpen(Review review) {
        if (review.isClosed()) {
            throw new ConflictException(
                    "REVIEW_CLOSED",
                    "Wątek recenzji jest zamknięty. Otwórz nowy wątek, aby dodawać komentarze.");
        }
    }

    private void requireAuthorOrAdmin(UUID authorId, WorkspaceMember member) {
        if (authorId != null && authorId.equals(member.getUserId())) {
            return;
        }
        if (member.canEditWorkspace()) {
            return;
        }
        throw new ForbiddenAccessException(
                "COMMENT_FORBIDDEN",
                "Tylko autor lub administrator przestrzeni może usunąć tę treść.");
    }

    private void requireParentComment(Pin pin, UUID parentCommentId) {
        if (parentCommentId == null) {
            return;
        }
        PinComment parent = comments.findByIdAndDeletedAtIsNull(parentCommentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "COMMENT_NOT_FOUND",
                        "Nie znaleziono komentarza nadrzędnego."));
        if (!pin.getId().equals(parent.getPinId())) {
            throw new InvalidRequestException(
                    "INVALID_PARENT_COMMENT",
                    "Komentarz nadrzędny musi należeć do tej samej pinezki.");
        }

        int parentDepth = 1;
        PinComment ancestor = parent;
        Set<UUID> visited = new HashSet<>();
        while (ancestor.getParentCommentId() != null) {
            if (!visited.add(ancestor.getId())) {
                break; // Defensive: ignore a corrupted cycle.
            }
            ancestor = comments.findById(ancestor.getParentCommentId()).orElse(null);
            if (ancestor == null) {
                break;
            }
            parentDepth++;
        }
        if (parentDepth >= MAX_COMMENT_DEPTH) {
            throw new InvalidRequestException(
                    "COMMENT_DEPTH_EXCEEDED",
                    "Komentarze mogą być zagnieżdżone najwyżej na trzech poziomach.");
        }
    }

    private double requireCoordinate(Double value) {
        if (value == null || !Double.isFinite(value) || value < 0 || value > 100) {
            throw new InvalidRequestException(
                    "INVALID_COORDINATES",
                    "Współrzędne pinezki muszą mieścić się w zakresie 0–100.");
        }
        // Persist and return at most three decimal places (HALF_UP) to match
        // the NUMERIC(6,3) columns and keep responses stable across databases.
        return BigDecimal.valueOf(value)
                .setScale(3, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private String requireBody(String body) {
        String trimmed = body == null ? "" : body.trim();
        if (trimmed.isEmpty()) {
            throw new InvalidRequestException(
                    "COMMENT_BODY_REQUIRED",
                    "Treść komentarza nie może być pusta.");
        }
        return trimmed;
    }

    private List<Asset> requireAttachments(UUID projectId, List<UUID> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<UUID> unique = new LinkedHashSet<>(assetIds);
        if (unique.size() > MAX_ATTACHMENTS) {
            throw new InvalidRequestException(
                    "TOO_MANY_ATTACHMENTS",
                    "Do jednego komentarza można dołączyć najwyżej 10 plików.");
        }
        if (unique.contains(null)) {
            throw new ResourceNotFoundException(
                    "ATTACHMENT_NOT_FOUND",
                    "Nie znaleziono załącznika w tym projekcie.");
        }
        Map<UUID, Asset> found = new HashMap<>();
        for (Asset asset : assets.findAllById(unique)) {
            if (asset.getDeletedAt() == null) {
                found.put(asset.getId(), asset);
            }
        }
        List<Asset> ordered = new ArrayList<>();
        for (UUID assetId : unique) {
            Asset asset = found.get(assetId);
            if (asset == null
                    || !projectId.equals(asset.getProjectId())
                    || !Asset.PURPOSE_ATTACHMENT.equals(asset.getPurpose())
                    || !Asset.STATUS_READY.equals(asset.getStatus())) {
                throw new ResourceNotFoundException(
                        "ATTACHMENT_NOT_FOUND",
                        "Nie znaleziono załącznika w tym projekcie.");
            }
            ordered.add(asset);
        }
        return ordered;
    }

    private void saveAttachments(UUID commentId, List<Asset> attachmentAssets) {
        for (int position = 0; position < attachmentAssets.size(); position++) {
            attachments.save(new PinCommentAttachment(
                    commentId, attachmentAssets.get(position).getId(), position));
        }
    }

    private Set<UUID> userIds(
            Collection<Pin> pins,
            Collection<PinComment> thread,
            Collection<ReviewApproval> approvals) {
        Set<UUID> ids = new LinkedHashSet<>();
        for (Pin pin : pins) {
            addIfPresent(ids, pin.getCreatedBy());
            addIfPresent(ids, pin.getResolvedBy());
        }
        for (PinComment comment : thread) {
            addIfPresent(ids, comment.getAuthorId());
        }
        for (ReviewApproval approval : approvals) {
            addIfPresent(ids, approval.getUserId());
        }
        return ids;
    }

    private void addIfPresent(Set<UUID> ids, UUID id) {
        if (id != null) {
            ids.add(id);
        }
    }

    /** One query per response instead of one lookup per author. */
    private Map<UUID, User> loadUsers(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, User> found = new HashMap<>();
        for (User user : users.findAllById(userIds)) {
            found.put(user.getId(), user);
        }
        return found;
    }

    private String displayName(UUID userId, Map<UUID, User> usersById) {
        if (userId == null) return UNKNOWN_USER;
        User user = usersById.get(userId);
        return user == null ? UNKNOWN_USER : user.getDisplayName();
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
