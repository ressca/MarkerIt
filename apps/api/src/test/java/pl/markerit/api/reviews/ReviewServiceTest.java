package pl.markerit.api.reviews;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.markerit.api.assets.Asset;
import pl.markerit.api.assets.AssetRepository;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.feedback.Pin;
import pl.markerit.api.feedback.PinComment;
import pl.markerit.api.feedback.PinCommentAttachment;
import pl.markerit.api.feedback.PinCommentAttachmentRepository;
import pl.markerit.api.feedback.PinCommentRepository;
import pl.markerit.api.feedback.PinRepository;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.realtime.ReviewRealtimePublisher;
import pl.markerit.api.reviews.web.CreateReviewRequest;
import pl.markerit.api.reviews.web.CreateVersionRequest;
import pl.markerit.api.reviews.web.ReviewResponse;
import pl.markerit.api.reviews.web.SubmitApprovalRequest;
import pl.markerit.api.reviews.web.UpdateReviewRequest;
import pl.markerit.api.storage.AssetStorageResolver;
import pl.markerit.api.storage.StorageService;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceMemberRepository;
import pl.markerit.api.workspaces.WorkspaceService;

class ReviewServiceTest {

    private ReviewRepository reviews;
    private ReviewVersionRepository versions;
    private ReviewVersionAssetRepository versionAssets;
    private ReviewReviewerRepository reviewers;
    private ReviewApprovalRepository approvals;
    private PinRepository pins;
    private PinCommentRepository comments;
    private PinCommentAttachmentRepository commentAttachments;
    private ProjectService projects;
    private WorkspaceService workspaces;
    private WorkspaceMemberRepository workspaceMembers;
    private UserRepository users;
    private AssetRepository assets;
    private StorageService storage;
    private ReviewRealtimePublisher realtime;
    private ReviewService service;

    private UUID userId;
    private UUID otherUserId;
    private UUID workspaceId;
    private UUID projectId;
    private Project project;
    private User user;
    private User otherUser;

    @BeforeEach void setUp() {
        reviews = mock(ReviewRepository.class);
        versions = mock(ReviewVersionRepository.class);
        versionAssets = mock(ReviewVersionAssetRepository.class);
        reviewers = mock(ReviewReviewerRepository.class);
        approvals = mock(ReviewApprovalRepository.class);
        pins = mock(PinRepository.class);
        comments = mock(PinCommentRepository.class);
        commentAttachments = mock(PinCommentAttachmentRepository.class);
        projects = mock(ProjectService.class);
        workspaces = mock(WorkspaceService.class);
        workspaceMembers = mock(WorkspaceMemberRepository.class);
        users = mock(UserRepository.class);
        assets = mock(AssetRepository.class);
        storage = mock(StorageService.class);
        realtime = mock(ReviewRealtimePublisher.class);
        when(storage.provider()).thenReturn("S3");

        service = new ReviewService(
                reviews,
                versions,
                versionAssets,
                reviewers,
                approvals,
                pins,
                comments,
                commentAttachments,
                projects,
                workspaces,
                workspaceMembers,
                users,
                assets,
                new AssetStorageResolver(List.of(storage)),
                realtime);

        userId = UUID.randomUUID();
        otherUserId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        projectId = project.getId();
        user = user("Anna Kowalska", "anna@example.com");
        otherUser = user("Jan Nowak", "jan@example.com");

        when(projects.requireProject(projectId)).thenReturn(project);
        when(workspaces.requireMember(eq(workspaceId), any())).thenReturn(
                member(userId, "MEMBER"));
        when(workspaces.requireProjectManager(workspaceId, userId)).thenReturn(
                member(userId, "MEMBER"));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(users.findById(otherUserId)).thenReturn(Optional.of(otherUser));
        when(reviews.saveAndFlush(any(Review.class))).thenAnswer(call -> call.getArgument(0));
        when(reviews.save(any(Review.class))).thenAnswer(call -> call.getArgument(0));
        when(versions.saveAndFlush(any(ReviewVersion.class))).thenAnswer(call -> call.getArgument(0));
        when(versionAssets.save(any(ReviewVersionAsset.class))).thenAnswer(call -> call.getArgument(0));
        when(reviewers.save(any(ReviewReviewer.class))).thenAnswer(call -> call.getArgument(0));
        when(approvals.save(any(ReviewApproval.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test void listsThreadsForProjectMembers() {
        Review review = review(userId);
        when(reviews.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(projectId))
                .thenReturn(List.of(review));

        var result = service.list(userId, projectId);

        assertEquals(1, result.size());
        assertEquals("Recenzja", result.getFirst().title());
        assertEquals("Anna Kowalska", result.getFirst().createdByName());
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void createsThreadWithFirstVersionAndReviewers() {
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, otherUserId))
                .thenReturn(Optional.of(member(otherUserId, "MEMBER")));

        ReviewResponse response = service.create(userId, projectId, new CreateReviewRequest(
                "  Nowa recenzja  ", " opis ", asset.getId(), List.of(otherUserId)));

        assertEquals("Nowa recenzja", response.summary().title());
        assertEquals("opis", response.summary().description());
        assertEquals(Review.STATUS_OPEN, response.summary().status());
        verify(workspaces).requireProjectManager(workspaceId, userId);
        verify(versionAssets).save(argThat(link ->
                link.getAssetId().equals(asset.getId()) && link.getPosition() == 0));
        verify(reviewers).save(argThat(assignment -> assignment.getUserId().equals(otherUserId)));
        verify(versions).saveAndFlush(argThat(version -> version.getVersionNumber() == 1));
    }

    @Test void rejectsCreationForClosedProject() {
        project.update(null, null, Project.STATUS_CLOSED, null);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, UUID.randomUUID(), null)));

        assertEquals("PROJECT_CLOSED", exception.getCode());
        verify(reviews, never()).saveAndFlush(any());
    }

    @Test void rejectsVersionAssetFromAnotherProject() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, asset.getId(), null)));

        assertEquals("INVALID_VERSION_ASSET", exception.getCode());
        verify(reviews, never()).saveAndFlush(any());
    }

    @Test void rejectsNonReadyVersionAsset() {
        Asset asset = asset(projectId);
        when(asset.getStatus()).thenReturn("PENDING");
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, asset.getId(), null)));

        assertEquals("INVALID_VERSION_ASSET", exception.getCode());
    }

    @Test void reportsMissingVersionAsset() {
        UUID assetId = UUID.randomUUID();
        when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, assetId, null)));

        assertEquals("ASSET_NOT_FOUND", exception.getCode());
    }

    @Test void rejectsMissingAssetId() {
        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, null, null)));

        assertEquals("INVALID_VERSION_ASSET", exception.getCode());
    }

    @Test void rejectsReviewerOutsideWorkspace() {
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, otherUserId))
                .thenReturn(Optional.empty());

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, asset.getId(), List.of(otherUserId))));

        assertEquals("INVALID_REVIEWER", exception.getCode());
        verify(reviews, never()).saveAndFlush(any());
    }

    @Test void rejectsViewerReviewer() {
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, otherUserId))
                .thenReturn(Optional.of(member(otherUserId, "VIEWER")));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, asset.getId(), List.of(otherUserId))));

        assertEquals("INVALID_REVIEWER_ROLE", exception.getCode());
        verify(reviews, never()).saveAndFlush(any());
    }

    @Test void requiresProjectManagerToCreateThread() {
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        assertThrows(ForbiddenAccessException.class,
                () -> service.create(userId, projectId, new CreateReviewRequest(
                        "Recenzja", null, asset.getId(), null)));
    }

    @Test void returnsThreadDetailForMember() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, "nota", userId);
        Asset asset = asset(projectId);
        UUID assetId = asset.getId();
        when(reviews.findByIdAndDeletedAtIsNull(review.getId())).thenReturn(Optional.of(review));
        when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId())).thenReturn(List.of(version));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(versionAssets.findForVersion(version.getId())).thenReturn(List.of(
                new ReviewVersionAsset(version.getId(), assetId, 0)));
        when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(asset));

        ReviewResponse response = service.get(userId, review.getId());

        assertEquals(review.getId(), response.summary().id());
        assertEquals(1, response.versions().size());
        assertEquals(assetId, response.versions().getFirst().asset().id());
        assertEquals("nota", response.versions().getFirst().note());
    }

    @Test void reportsMissingThread() {
        UUID reviewId = UUID.randomUUID();
        when(reviews.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.get(userId, reviewId));

        assertEquals("REVIEW_NOT_FOUND", exception.getCode());
    }

    @Test void onlyAuthorUpdatesThread() {
        Review review = review(otherUserId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.update(userId, review.getId(),
                        new UpdateReviewRequest("Nowy tytuł", null, null)));

        assertEquals("REVIEW_FORBIDDEN", exception.getCode());
    }

    @Test void authorUpdatesTitleAndReviewerAssignments() {
        Review review = review(userId);
        ReviewReviewer kept = new ReviewReviewer(review.getId(), otherUserId, userId);
        ReviewReviewer removed = new ReviewReviewer(review.getId(), UUID.randomUUID(), userId);
        UUID addedId = UUID.randomUUID();
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(kept, removed));
        when(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, otherUserId))
                .thenReturn(Optional.of(member(otherUserId, "MEMBER")));
        when(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, addedId))
                .thenReturn(Optional.of(member(addedId, "MEMBER")));

        ReviewResponse response = service.update(userId, review.getId(),
                new UpdateReviewRequest("  Poprawki  ", " nowy opis ",
                        List.of(otherUserId, addedId, otherUserId)));

        assertEquals("Poprawki", response.summary().title());
        assertEquals("nowy opis", response.summary().description());
        verify(reviewers).delete(removed);
        verify(reviewers, never()).delete(kept);
        verify(reviewers).save(argThat(assignment -> assignment.getUserId().equals(addedId)));
        verify(reviews).save(review);
    }

    @Test void clearingDescriptionRemovesIt() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));

        ReviewResponse response = service.update(userId, review.getId(),
                new UpdateReviewRequest(null, "  ", null));

        assertNull(response.summary().description());
    }

    @Test void closedThreadRejectsMutations() {
        Review review = review(userId);
        review.close(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, userId)));

        ConflictException update = assertThrows(ConflictException.class,
                () -> service.update(userId, review.getId(),
                        new UpdateReviewRequest("Tytuł", null, null)));
        ConflictException version = assertThrows(ConflictException.class,
                () -> service.addVersion(userId, review.getId(),
                        new CreateVersionRequest(UUID.randomUUID(), null)));
        ConflictException approval = assertThrows(ConflictException.class,
                () -> service.submitApproval(userId, review.getId(),
                        new SubmitApprovalRequest("APPROVED", null)));
        ConflictException close = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_CLOSED", update.getCode());
        assertEquals("REVIEW_CLOSED", version.getCode());
        assertEquals("REVIEW_CLOSED", approval.getCode());
        assertEquals("REVIEW_CLOSED", close.getCode());
        verify(reviews, times(4)).findByIdForUpdate(review.getId());
        verify(reviews, never()).findByIdAndDeletedAtIsNull(any());
    }

    @Test void viewerAuthorCannotUpdateApproveOrClose() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(workspaces.requireMember(eq(workspaceId), eq(userId)))
                .thenReturn(member(userId, "VIEWER"));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, userId)));

        ForbiddenAccessException update = assertThrows(ForbiddenAccessException.class,
                () -> service.update(userId, review.getId(),
                        new UpdateReviewRequest("Tytuł", null, null)));
        ForbiddenAccessException approval = assertThrows(ForbiddenAccessException.class,
                () -> service.submitApproval(userId, review.getId(),
                        new SubmitApprovalRequest("APPROVED", null)));
        ForbiddenAccessException close = assertThrows(ForbiddenAccessException.class,
                () -> service.close(userId, review.getId()));
        ForbiddenAccessException delete = assertThrows(ForbiddenAccessException.class,
                () -> service.delete(userId, review.getId()));

        assertEquals("REVIEW_FORBIDDEN", update.getCode());
        assertEquals("REVIEW_FORBIDDEN", approval.getCode());
        assertEquals("REVIEW_FORBIDDEN", close.getCode());
        assertEquals("REVIEW_FORBIDDEN", delete.getCode());
    }

    @Test void onlyAuthorAddsVersions() {
        Review review = review(otherUserId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.addVersion(userId, review.getId(),
                        new CreateVersionRequest(asset.getId(), null)));

        assertEquals("REVIEW_FORBIDDEN", exception.getCode());
        verify(versions, never()).saveAndFlush(any());
    }

    @Test void authorAddsNextVersion() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        UUID assetId = asset.getId();
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(new ReviewVersion(review.getId(), 2, null, userId)));
        when(versionAssets.findForVersion(any())).thenReturn(List.of(
                new ReviewVersionAsset(UUID.randomUUID(), assetId, 0)));

        var response = service.addVersion(userId, review.getId(),
                new CreateVersionRequest(asset.getId(), "  druga wersja "));

        assertEquals(3, response.versionNumber());
        assertEquals("druga wersja", response.note());
        verify(versionAssets).save(argThat(link ->
                link.getAssetId().equals(asset.getId()) && link.getPosition() == 0));
        verify(reviews).save(review);
    }

    @Test void addVersionRejectsInvalidAsset() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.addVersion(userId, review.getId(),
                        new CreateVersionRequest(asset.getId(), null)));

        assertEquals("INVALID_VERSION_ASSET", exception.getCode());
    }

    @Test void addVersionRejectsClosedProject() {
        Review review = review(userId);
        project.update(null, null, Project.STATUS_CLOSED, null);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.addVersion(userId, review.getId(),
                        new CreateVersionRequest(UUID.randomUUID(), null)));

        assertEquals("PROJECT_CLOSED", exception.getCode());
        verify(versions, never()).saveAndFlush(any());
    }

    @Test void onlyAssignedReviewerSubmitsDecision() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of());

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.submitApproval(userId, review.getId(),
                        new SubmitApprovalRequest("APPROVED", null)));

        assertEquals("REVIEW_FORBIDDEN", exception.getCode());
    }

    @Test void reviewerSubmitsApprovalWithTrimmedNoteAndVersion() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));

        var response = service.submitApproval(otherUserId, review.getId(),
                new SubmitApprovalRequest(" approved ", "  wygląda dobrze "));

        assertEquals(otherUserId, response.userId());
        assertEquals(version.getId(), response.versionId());
        assertEquals(ReviewApproval.DECISION_APPROVED, response.decision());
        assertEquals("wygląda dobrze", response.note());
        assertEquals("Jan Nowak", response.displayName());
        verify(approvals).save(argThat(approval ->
                approval.getReviewVersionId().equals(version.getId())
                        && approval.getDecision().equals(ReviewApproval.DECISION_APPROVED)));
    }

    @Test void approvalRequiresLatestVersion() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.submitApproval(otherUserId, review.getId(),
                        new SubmitApprovalRequest("APPROVED", null)));

        assertEquals("REVIEW_VERSION_MISSING", exception.getCode());
    }

    @Test void rejectsUnknownDecision() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.submitApproval(otherUserId, review.getId(),
                        new SubmitApprovalRequest("MAYBE", null)));

        assertEquals("INVALID_DECISION", exception.getCode());
    }

    @Test void approvalsAreScopedToLatestVersionAndMustBeRenewedAfterNewVersion() {
        Review review = review(userId);
        ReviewVersion version1 = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version1));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));

        var approval = service.submitApproval(otherUserId, review.getId(),
                new SubmitApprovalRequest("APPROVED", null));

        assertEquals(version1.getId(), approval.versionId());

        Asset asset = asset(projectId);
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version1));

        var added = service.addVersion(userId, review.getId(),
                new CreateVersionRequest(asset.getId(), null));
        assertEquals(2, added.versionNumber());

        ReviewVersion version2 = new ReviewVersion(review.getId(), 2, null, userId);
        ReviewReviewer assignment = new ReviewReviewer(review.getId(), otherUserId, userId);
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version2));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(assignment));
        when(approvals.findNewestFirst(review.getId(), version2.getId())).thenReturn(List.of());

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));
        assertEquals("REVIEW_NOT_APPROVED", exception.getCode());

        when(approvals.findNewestFirst(review.getId(), version2.getId())).thenReturn(List.of(
                new ReviewApproval(
                        review.getId(),
                        version2.getId(),
                        otherUserId,
                        ReviewApproval.DECISION_APPROVED,
                        null)));

        ReviewResponse response = service.close(userId, review.getId());

        assertEquals(Review.STATUS_CLOSED, response.summary().status());
    }

    @Test void reAddedReviewerRequiresFreshApprovalAfterOldDecision() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        ReviewReviewer assignment = new ReviewReviewer(review.getId(), otherUserId, userId);
        ReviewApproval staleApproval = mock(ReviewApproval.class);
        when(staleApproval.getUserId()).thenReturn(otherUserId);
        when(staleApproval.getDecision()).thenReturn(ReviewApproval.DECISION_APPROVED);
        when(staleApproval.getReviewVersionId()).thenReturn(version.getId());
        when(staleApproval.getCreatedAt()).thenReturn(Instant.now().minusSeconds(60));
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(assignment));
        when(approvals.findNewestFirst(review.getId(), version.getId()))
                .thenReturn(List.of(staleApproval));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_NOT_APPROVED", exception.getCode());
        assertFalse(review.isClosed());
    }

    @Test void cannotCloseUntilEveryCurrentReviewerApproves() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, userId),
                new ReviewReviewer(review.getId(), otherUserId, userId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), userId, ReviewApproval.DECISION_APPROVED),
                approval(review.getId(), version.getId(), otherUserId, ReviewApproval.DECISION_CHANGES_REQUESTED)));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_NOT_APPROVED", exception.getCode());
        assertFalse(review.isClosed());
    }

    @Test void missingDecisionBlocksClosing() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of());

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_NOT_APPROVED", exception.getCode());
    }

    @Test void closesWhenEveryCurrentReviewerApproved() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId()))
                .thenReturn(List.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, userId),
                new ReviewReviewer(review.getId(), otherUserId, userId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), userId, ReviewApproval.DECISION_APPROVED),
                approval(review.getId(), version.getId(), otherUserId, ReviewApproval.DECISION_APPROVED)));

        ReviewResponse response = service.close(userId, review.getId());

        assertEquals(Review.STATUS_CLOSED, response.summary().status());
        assertNotNull(review.getClosedAt());
        assertEquals(userId, review.getClosedBy());
        assertEquals(userId, response.summary().closedBy());
        assertEquals("Anna Kowalska", response.summary().closedByName());
        verify(reviews).save(review);
    }

    @Test void reviewerCanCloseAfterApproving() {
        Review review = review(otherUserId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, otherUserId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), userId, ReviewApproval.DECISION_APPROVED)));

        ReviewResponse response = service.close(userId, review.getId());

        assertEquals(Review.STATUS_CLOSED, response.summary().status());
        assertEquals(userId, review.getClosedBy());
    }

    @Test void reviewerCannotCloseWhileAnotherReviewerHasNotApproved() {
        Review review = review(otherUserId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, otherUserId),
                new ReviewReviewer(review.getId(), UUID.randomUUID(), otherUserId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), userId, ReviewApproval.DECISION_APPROVED)));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_NOT_APPROVED", exception.getCode());
    }

    @Test void authorClosesThreadWithoutReviewers() {
        Review review = review(userId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of());

        ReviewResponse response = service.close(userId, review.getId());

        assertEquals(Review.STATUS_CLOSED, response.summary().status());
    }

    @Test void nonReviewerCannotCloseThreadWithoutReviewers() {
        Review review = review(otherUserId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of());

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.close(userId, review.getId()));

        assertEquals("REVIEW_FORBIDDEN", exception.getCode());
        assertFalse(review.isClosed());
    }

    @Test void removedReviewersApprovalNoLongerBlocksClosing() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        UUID removedReviewer = UUID.randomUUID();
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), otherUserId, userId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), removedReviewer, ReviewApproval.DECISION_CHANGES_REQUESTED),
                approval(review.getId(), version.getId(), otherUserId, ReviewApproval.DECISION_APPROVED)));

        ReviewResponse response = service.close(userId, review.getId());

        assertEquals(Review.STATUS_CLOSED, response.summary().status());
    }

    @Test void approvalSummaryCountsOnlyCurrentReviewers() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        UUID removedReviewer = UUID.randomUUID();
        when(reviews.findByIdAndDeletedAtIsNull(review.getId())).thenReturn(Optional.of(review));
        when(versions.findFirstByReviewIdOrderByVersionNumberDesc(review.getId()))
                .thenReturn(Optional.of(version));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, userId),
                new ReviewReviewer(review.getId(), otherUserId, userId)));
        when(approvals.findNewestFirst(review.getId(), version.getId())).thenReturn(List.of(
                approval(review.getId(), version.getId(), removedReviewer, ReviewApproval.DECISION_APPROVED),
                approval(review.getId(), version.getId(), userId, ReviewApproval.DECISION_APPROVED),
                approval(review.getId(), version.getId(), otherUserId, ReviewApproval.DECISION_CHANGES_REQUESTED)));

        ReviewResponse response = service.get(userId, review.getId());

        assertEquals(1, response.summary().approvalSummary().approved());
        assertEquals(1, response.summary().approvalSummary().changesRequested());
        assertEquals(0, response.summary().approvalSummary().pending());
        assertEquals(2, response.summary().approvalSummary().total());
        assertEquals(2, response.summary().reviewerCount());
        assertEquals(3, response.approvals().size());
        assertEquals(version.getId(), response.approvals().getFirst().versionId());
    }

    @Test void nonReviewerCannotDeleteThread() {
        Review review = review(otherUserId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of());

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.delete(userId, review.getId()));

        assertEquals("REVIEW_FORBIDDEN", exception.getCode());
        verify(reviews, never()).delete(any());
    }

    @Test void deleteLocksReviewBeforeReadingVersionsAndAssets() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        Asset asset = asset(projectId);
        UUID assetId = asset.getId();
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of());
        when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId())).thenReturn(List.of(version));
        when(versionAssets.findForVersions(List.of(version.getId()))).thenReturn(List.of(
                new ReviewVersionAsset(version.getId(), assetId, 0)));
        when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(asset));
        when(versionAssets.countByAssetId(assetId)).thenReturn(0L);

        service.delete(userId, review.getId());

        InOrder inOrder = inOrder(reviews, versions, versionAssets, assets);
        inOrder.verify(reviews).findByIdForUpdate(review.getId());
        inOrder.verify(versions).findByReviewIdOrderByVersionNumberAsc(review.getId());
        inOrder.verify(versionAssets).findForVersions(List.of(version.getId()));
        inOrder.verify(assets).findByIdAndDeletedAtIsNull(assetId);
        verify(reviews, never()).findByIdAndDeletedAtIsNull(any());
    }

    @Test void authorDeletesThreadAndUnreferencedAssets() {
        Review review = review(userId);
        ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
        Asset usedOnlyHere = asset(projectId);
        Asset usedElsewhere = asset(projectId);
        UUID usedOnlyHereId = usedOnlyHere.getId();
        UUID usedElsewhereId = usedElsewhere.getId();
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId())).thenReturn(List.of(version));
        when(versionAssets.findForVersions(List.of(version.getId()))).thenReturn(List.of(
                new ReviewVersionAsset(version.getId(), usedOnlyHereId, 0),
                new ReviewVersionAsset(version.getId(), usedElsewhereId, 0)));
        when(assets.findByIdAndDeletedAtIsNull(usedOnlyHereId)).thenReturn(Optional.of(usedOnlyHere));
        when(assets.findByIdAndDeletedAtIsNull(usedElsewhereId)).thenReturn(Optional.of(usedElsewhere));
        when(versionAssets.countByAssetId(usedOnlyHereId)).thenReturn(0L);
        when(versionAssets.countByAssetId(usedElsewhereId)).thenReturn(1L);

        service.delete(userId, review.getId());

        verify(reviews).delete(review);
        verify(reviews).flush();
        verify(assets).delete(usedOnlyHere);
        verify(assets, never()).delete(usedElsewhere);
        verify(storage).deleteObject("projects/" + projectId + "/" + usedOnlyHereId + ".png");
        verify(storage, never()).deleteObject("projects/" + projectId + "/" + usedElsewhereId + ".png");
    }

    @Test void reviewerDeletesThread() {
        Review review = review(otherUserId);
        when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
        when(reviewers.findForReview(review.getId())).thenReturn(List.of(
                new ReviewReviewer(review.getId(), userId, otherUserId)));
        when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId())).thenReturn(List.of());

        service.delete(userId, review.getId());

        verify(reviews).delete(review);
    }

    @Test void storedObjectsAreDeletedOnlyAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        try {
            Review review = review(userId);
            ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
            Asset asset = asset(projectId);
            UUID assetId = asset.getId();
            when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
            when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId()))
                    .thenReturn(List.of(version));
            when(versionAssets.findForVersions(List.of(version.getId()))).thenReturn(List.of(
                    new ReviewVersionAsset(version.getId(), assetId, 0)));
            when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(asset));
            when(versionAssets.countByAssetId(assetId)).thenReturn(0L);

            service.delete(userId, review.getId());

            verify(storage, never()).deleteObject(anyString());
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit);
            verify(storage).deleteObject("projects/" + projectId + "/" + assetId + ".png");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test void storageDeleteFailureAfterCommitDoesNotEscape() {
        TransactionSynchronizationManager.initSynchronization();
        try {
            Review review = review(userId);
            ReviewVersion version = new ReviewVersion(review.getId(), 1, null, userId);
            Asset asset = asset(projectId);
            UUID assetId = asset.getId();
            when(reviews.findByIdForUpdate(review.getId())).thenReturn(Optional.of(review));
            when(versions.findByReviewIdOrderByVersionNumberAsc(review.getId())).thenReturn(List.of(version));
            when(versionAssets.findForVersions(List.of(version.getId()))).thenReturn(List.of(
                    new ReviewVersionAsset(version.getId(), assetId, 0)));
            when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(asset));
            when(versionAssets.countByAssetId(assetId)).thenReturn(0L);
            doThrow(new IllegalStateException("S3 down")).when(storage).deleteObject(anyString());

            assertDoesNotThrow(() -> service.delete(userId, review.getId()));
            assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit));
            verify(storage).deleteObject("projects/" + projectId + "/" + assetId + ".png");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private Review review(UUID createdBy) {
        return new Review(projectId, "Recenzja", "Opis", createdBy);
    }

    private WorkspaceMember member(UUID memberId, String role) {
        return new WorkspaceMember(workspaceId, memberId, role, userId);
    }

    private User user(String displayName, String email) {
        User user = mock(User.class);
        when(user.getDisplayName()).thenReturn(displayName);
        when(user.getEmail()).thenReturn(email);
        return user;
    }

    private Asset asset(UUID assetProjectId) {
        UUID id = UUID.randomUUID();
        Asset asset = mock(Asset.class);
        when(asset.getId()).thenReturn(id);
        when(asset.getProjectId()).thenReturn(assetProjectId);
        when(asset.getPurpose()).thenReturn(Asset.PURPOSE_REVIEW_IMAGE);
        when(asset.getStatus()).thenReturn(Asset.STATUS_READY);
        when(asset.getStorageProvider()).thenReturn("S3");
        when(asset.getStorageKey()).thenReturn("projects/" + assetProjectId + "/" + id + ".png");
        when(asset.getContentType()).thenReturn("image/png");
        when(asset.getOriginalName()).thenReturn("shot.png");
        when(asset.getSizeBytes()).thenReturn(3L);
        when(asset.getWidth()).thenReturn(2);
        when(asset.getHeight()).thenReturn(3);
        when(asset.getCreatedAt()).thenReturn(Instant.now());
        return asset;
    }

    private ReviewApproval approval(UUID reviewId, UUID versionId, UUID userId, String decision) {
        return new ReviewApproval(reviewId, versionId, userId, decision, null);
    }
}
