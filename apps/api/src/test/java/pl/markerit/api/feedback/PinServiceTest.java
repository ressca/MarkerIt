package pl.markerit.api.feedback;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import pl.markerit.api.assets.Asset;
import pl.markerit.api.assets.AssetRepository;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.feedback.web.CommentResponse;
import pl.markerit.api.feedback.web.CreateCommentRequest;
import pl.markerit.api.feedback.web.CreatePinRequest;
import pl.markerit.api.feedback.web.DiscussionResponse;
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

class PinServiceTest {

    private PinRepository pins;
    private PinCommentRepository comments;
    private PinCommentAttachmentRepository attachments;
    private ReviewRepository reviews;
    private ReviewVersionRepository versions;
    private ReviewVersionAssetRepository versionAssets;
    private ReviewApprovalRepository approvals;
    private ProjectService projects;
    private WorkspaceService workspaces;
    private UserRepository users;
    private AssetRepository assets;
    private ReviewRealtimePublisher realtime;
    private PinService service;

    private UUID workspaceId;
    private UUID projectId;
    private UUID reviewId;
    private UUID versionId;
    private UUID imageAssetId;
    private UUID userId;
    private UUID otherUserId;
    private UUID adminId;
    private Project project;
    private Review review;
    private ReviewVersion version;
    private User user;
    private User otherUser;
    private User admin;

    @BeforeEach void setUp() {
        pins = mock(PinRepository.class);
        comments = mock(PinCommentRepository.class);
        attachments = mock(PinCommentAttachmentRepository.class);
        reviews = mock(ReviewRepository.class);
        versions = mock(ReviewVersionRepository.class);
        versionAssets = mock(ReviewVersionAssetRepository.class);
        approvals = mock(ReviewApprovalRepository.class);
        projects = mock(ProjectService.class);
        workspaces = mock(WorkspaceService.class);
        users = mock(UserRepository.class);
        assets = mock(AssetRepository.class);
        realtime = mock(ReviewRealtimePublisher.class);

        service = new PinService(
                pins,
                comments,
                attachments,
                reviews,
                versions,
                versionAssets,
                approvals,
                projects,
                workspaces,
                users,
                assets,
                realtime);

        workspaceId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        userId = UUID.randomUUID();
        otherUserId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        imageAssetId = UUID.randomUUID();

        project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        review = new Review(projectId, "Recenzja", null, userId);
        reviewId = review.getId();
        version = new ReviewVersion(reviewId, 1, null, userId);
        versionId = version.getId();

        user = user("Anna Kowalska");
        otherUser = user("Jan Nowak");
        admin = user("Admin Osoba");
        when(user.getId()).thenReturn(userId);
        when(otherUser.getId()).thenReturn(otherUserId);
        when(admin.getId()).thenReturn(adminId);

        when(projects.requireProject(projectId)).thenReturn(project);
        when(workspaces.requireMember(workspaceId, userId)).thenReturn(member(userId, "VIEWER"));
        when(workspaces.requireMember(workspaceId, otherUserId)).thenReturn(member(otherUserId, "MEMBER"));
        when(workspaces.requireMember(workspaceId, adminId)).thenReturn(member(adminId, "ADMIN"));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(users.findById(otherUserId)).thenReturn(Optional.of(otherUser));
        when(users.findById(adminId)).thenReturn(Optional.of(admin));
        when(users.findAllById(any())).thenAnswer(invocation -> {
            Iterable<UUID> ids = invocation.getArgument(0);
            List<User> result = new ArrayList<>();
            for (UUID id : ids) {
                if (id.equals(userId)) {
                    result.add(user);
                } else if (id.equals(otherUserId)) {
                    result.add(otherUser);
                } else if (id.equals(adminId)) {
                    result.add(admin);
                }
            }
            return result;
        });
        when(reviews.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(review));
        when(reviews.findByIdForUpdate(reviewId)).thenReturn(Optional.of(review));
        when(versions.findById(versionId)).thenReturn(Optional.of(version));
        when(versionAssets.findForVersion(versionId)).thenReturn(
                List.of(new ReviewVersionAsset(versionId, imageAssetId, 0)));
        when(pins.saveAndFlush(any(Pin.class))).thenAnswer(call -> call.getArgument(0));
        when(pins.save(any(Pin.class))).thenAnswer(call -> call.getArgument(0));
        when(comments.save(any(PinComment.class))).thenAnswer(call -> call.getArgument(0));
        when(comments.saveAndFlush(any(PinComment.class))).thenAnswer(call -> call.getArgument(0));
        when(comments.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        when(attachments.save(any(PinCommentAttachment.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test void createsPinWithFirstCommentAndAttachments() {
        Asset attachment = attachmentAsset(projectId);
        when(assets.findAllById(any())).thenReturn(List.of(attachment));

        PinResponse response = service.createPin(userId, reviewId, versionId, new CreatePinRequest(
                12.5, 44.25, "  Popraw margines  ", List.of(attachment.getId())));

        assertEquals(imageAssetId, response.assetId());
        assertEquals(12.5, response.xPercent());
        assertEquals(44.25, response.yPercent());
        assertEquals(Pin.STATUS_OPEN, response.status());
        assertEquals(userId, response.authorId());
        assertEquals("Anna Kowalska", response.authorName());
        assertEquals(1, response.comments().size());
        assertEquals("Popraw margines", response.comments().getFirst().body());
        assertEquals(response.id(), response.comments().getFirst().pinId());
        assertEquals(1, response.comments().getFirst().attachments().size());
        assertEquals(attachment.getId(),
                response.comments().getFirst().attachments().getFirst().id());
        verify(attachments).save(argThat(link ->
                response.comments().getFirst().id().equals(link.getPinCommentId())
                        && attachment.getId().equals(link.getAssetId())
                        && link.getPosition() == 0));
        verify(realtime).pinCreated(
                eq(projectId), eq(reviewId), eq(versionId), any(PinResponse.class));
    }

    @Test void createPinRequiresMembership() {
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(ForbiddenAccessException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of())));
        verify(pins, never()).saveAndFlush(any());
    }

    @Test void createPinRejectsClosedReview() {
        review.close(userId);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of())));

        assertEquals("REVIEW_CLOSED", exception.getCode());
        verify(pins, never()).saveAndFlush(any());
    }

    @Test void createPinRejectsVersionFromAnotherReview() {
        ReviewVersion otherVersion = new ReviewVersion(UUID.randomUUID(), 1, null, userId);
        when(versions.findById(otherVersion.getId())).thenReturn(Optional.of(otherVersion));

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.createPin(userId, reviewId, otherVersion.getId(),
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of())));

        assertEquals("VERSION_NOT_FOUND", exception.getCode());
    }

    @Test void createPinRejectsVersionWithoutImage() {
        when(versionAssets.findForVersion(versionId)).thenReturn(List.of());

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of())));

        assertEquals("VERSION_ASSET_MISSING", exception.getCode());
    }

    @Test void createPinRejectsCoordinatesOutsidePercentRange() {
        for (Double invalid : new Double[] {-1.0, 100.5, Double.NaN, Double.POSITIVE_INFINITY}) {
            InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                    () -> service.createPin(userId, reviewId, versionId,
                            new CreatePinRequest(invalid, 50.0, "Treść", List.of())),
                    "coordinate " + invalid);
            assertEquals("INVALID_COORDINATES", exception.getCode());
        }
        InvalidRequestException yException = assertThrows(InvalidRequestException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(50.0, null, "Treść", List.of())));
        assertEquals("INVALID_COORDINATES", yException.getCode());
        verify(pins, never()).saveAndFlush(any());
    }

    @Test void createPinRejectsBlankBody() {
        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(10.0, 10.0, "   ", List.of())));

        assertEquals("COMMENT_BODY_REQUIRED", exception.getCode());
        verify(pins, never()).saveAndFlush(any());
    }

    @Test void createPinRejectsAttachmentFromAnotherProject() {
        Asset attachment = attachmentAsset(UUID.randomUUID());
        when(assets.findAllById(any())).thenReturn(List.of(attachment));

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of(attachment.getId()))));

        assertEquals("ATTACHMENT_NOT_FOUND", exception.getCode());
    }

    @Test void createPinRejectsAssetThatIsNotAnAttachment() {
        Asset image = attachmentAsset(projectId);
        when(image.getPurpose()).thenReturn(Asset.PURPOSE_REVIEW_IMAGE);
        when(assets.findAllById(any())).thenReturn(List.of(image));

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", List.of(image.getId()))));

        assertEquals("ATTACHMENT_NOT_FOUND", exception.getCode());
    }

    @Test void listPinsRequiresVersionAndReturnsCommentsWithAttachments() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), userId, "Uwaga");
        comment.onCreate();
        Asset attachment = attachmentAsset(projectId);

        when(pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(versionId))
                .thenReturn(List.of(pin));
        PinCommentAttachment link =
                new PinCommentAttachment(comment.getId(), attachment.getId(), 0);
        when(comments.findByPinIdInOrderByCreatedAtAscIdAsc(any()))
                .thenReturn(List.of(comment));
        when(attachments.findByIdPinCommentIdInOrderByIdPinCommentIdAscPositionAsc(any()))
                .thenReturn(List.of(link));
        when(assets.findAllById(any())).thenReturn(List.of(attachment));

        List<PinResponse> result = service.listPins(userId, reviewId, versionId);

        assertEquals(1, result.size());
        assertEquals(1, result.getFirst().comments().size());
        assertEquals(1, result.getFirst().comments().getFirst().attachments().size());
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void listPinsReturnsEmptyWhenVersionHasNoPins() {
        when(pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(versionId))
                .thenReturn(List.of());

        assertTrue(service.listPins(userId, reviewId, versionId).isEmpty());
        verifyNoInteractions(attachments);
    }

    @Test void updatePinResolvesAndReopens() {
        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        PinResponse resolved = service.updatePin(userId, pin.getId(),
                new UpdatePinRequest("resolved"));

        assertEquals(Pin.STATUS_RESOLVED, resolved.status());
        assertEquals(userId, resolved.resolvedBy());
        assertNotNull(resolved.resolvedAt());
        verify(realtime).pinUpdated(
                eq(projectId), eq(reviewId), eq(versionId), any(PinResponse.class));

        PinResponse reopened = service.updatePin(userId, pin.getId(), new UpdatePinRequest("OPEN"));

        assertEquals(Pin.STATUS_OPEN, reopened.status());
        assertNull(reopened.resolvedBy());
        assertNull(reopened.resolvedAt());
    }

    @Test void updatePinRejectsUnknownStatus() {
        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.updatePin(userId, pin.getId(), new UpdatePinRequest("DONE")));

        assertEquals("INVALID_PIN_STATUS", exception.getCode());
        verify(pins, never()).save(any());
    }

    @Test void resolveIsIdempotentAndKeepsOriginalResolver() {
        Pin pin = pin(userId);
        pin.resolve(otherUserId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        service.updatePin(userId, pin.getId(), new UpdatePinRequest("RESOLVED"));

        assertEquals(otherUserId, pin.getResolvedBy());
    }

    @Test void deletePinSoftDeletesPinAndCommentsForAuthor() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), userId, "Uwaga");
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByPinIdAndDeletedAtIsNull(pin.getId())).thenReturn(List.of(comment));

        service.deletePin(userId, pin.getId());

        assertNotNull(pin.getDeletedAt());
        assertNotNull(comment.getDeletedAt());
        verify(realtime).pinDeleted(projectId, reviewId, versionId, pin.getId());
    }

    @Test void adminCanDeleteSomeoneElsesPin() {
        Pin pin = pin(otherUserId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        service.deletePin(adminId, pin.getId());

        assertNotNull(pin.getDeletedAt());
    }

    @Test void regularMemberCannotDeleteSomeoneElsesPin() {
        Pin pin = pin(otherUserId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.deletePin(userId, pin.getId()));

        assertEquals("COMMENT_FORBIDDEN", exception.getCode());
        assertNull(pin.getDeletedAt());
    }

    @Test void addCommentValidatesParentBelongsToPin() {
        Pin pin = pin(userId);
        Pin otherPin = pin(userId);
        PinComment parent = comment(otherPin.getId(), userId, "Inna pinezka");
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByIdAndDeletedAtIsNull(parent.getId())).thenReturn(Optional.of(parent));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest("Odpowiedź", parent.getId(), List.of())));

        assertEquals("INVALID_PARENT_COMMENT", exception.getCode());
    }

    @Test void addCommentRejectsMissingParent() {
        Pin pin = pin(userId);
        UUID parentId = UUID.randomUUID();
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByIdAndDeletedAtIsNull(parentId)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest("Odpowiedź", parentId, List.of())));

        assertEquals("COMMENT_NOT_FOUND", exception.getCode());
    }

    @Test void addCommentCreatesReplyWithAttachment() {
        Pin pin = pin(userId);
        PinComment parent = comment(pin.getId(), userId, "Rodzic");
        Asset attachment = attachmentAsset(projectId);
        when(assets.findAllById(any())).thenReturn(List.of(attachment));
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByIdAndDeletedAtIsNull(parent.getId())).thenReturn(Optional.of(parent));

        CommentResponse response = service.addComment(userId, pin.getId(),
                new CreateCommentRequest("  Odpowiedź ", parent.getId(), List.of(attachment.getId())));

        assertEquals(pin.getId(), response.pinId());
        assertEquals(parent.getId(), response.parentCommentId());
        assertEquals("Odpowiedź", response.body());
        assertEquals(1, response.attachments().size());
        verify(realtime).commentCreated(
                eq(projectId), eq(reviewId), eq(versionId), eq(pin.getId()), any());
    }

    @Test void addCommentRejectsClosedReview() {
        review.close(userId);
        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest("Treść", null, List.of())));

        assertEquals("REVIEW_CLOSED", exception.getCode());
        verify(comments, never()).save(any());
        verify(comments, never()).saveAndFlush(any());
    }

    @Test void addCommentRejectsBlankBody() {
        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest(" ", null, List.of())));

        assertEquals("COMMENT_BODY_REQUIRED", exception.getCode());
    }

    @Test void updatesCommentOnlyForAuthor() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), userId, "Stara treść");
        when(comments.findByIdAndDeletedAtIsNull(comment.getId())).thenReturn(Optional.of(comment));
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        CommentResponse response = service.updateComment(
                userId, comment.getId(), new UpdateCommentRequest("  Nowa treść  "));

        assertEquals("Nowa treść", response.body());
        assertNotNull(response.editedAt());
        verify(realtime).commentUpdated(
                eq(projectId), eq(reviewId), eq(versionId), eq(pin.getId()), any());

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.updateComment(otherUserId, comment.getId(),
                        new UpdateCommentRequest("Podmiana")));

        assertEquals("COMMENT_FORBIDDEN", exception.getCode());
        assertEquals("Nowa treść", comment.getBody());
    }

    @Test void updateCommentRejectsDeletedComment() {
        UUID commentId = UUID.randomUUID();
        when(comments.findByIdAndDeletedAtIsNull(commentId)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.updateComment(userId, commentId,
                        new UpdateCommentRequest("Treść")));

        assertEquals("COMMENT_NOT_FOUND", exception.getCode());
    }

    @Test void deleteCommentAllowsAuthorAndAdminOnly() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), otherUserId, "Treść");
        when(comments.findByIdAndDeletedAtIsNull(comment.getId())).thenReturn(Optional.of(comment));
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        ForbiddenAccessException exception = assertThrows(ForbiddenAccessException.class,
                () -> service.deleteComment(userId, comment.getId()));
        assertEquals("COMMENT_FORBIDDEN", exception.getCode());

        service.deleteComment(adminId, comment.getId());

        assertNotNull(comment.getDeletedAt());
        verify(realtime).commentDeleted(
                eq(projectId), eq(reviewId), eq(versionId), eq(pin.getId()),
                argThat(response -> response.id().equals(comment.getId()) && response.deleted()));
    }

    @Test void deleteCommentAllowsItsAuthor() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), userId, "Treść");
        when(comments.findByIdAndDeletedAtIsNull(comment.getId())).thenReturn(Optional.of(comment));
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));

        service.deleteComment(userId, comment.getId());

        assertNotNull(comment.getDeletedAt());
    }

    @Test void discussionCombinesPinsCommentsAndApprovalsChronologically() {
        Pin pin = pin(userId);
        PinComment first = comment(pin.getId(), userId, "Pierwszy");
        first.onCreate();
        PinComment second = comment(pin.getId(), otherUserId, "Drugi");
        second.onCreate();
        ReviewApproval approval = new ReviewApproval(
                reviewId, versionId, otherUserId, ReviewApproval.DECISION_APPROVED, "OK");
        Asset attachment = attachmentAsset(projectId);

        when(pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(versionId))
                .thenReturn(List.of(pin));
        PinCommentAttachment link =
                new PinCommentAttachment(first.getId(), attachment.getId(), 0);
        when(comments.findByPinIdInOrderByCreatedAtAscIdAsc(any()))
                .thenReturn(List.of(first, second));
        when(attachments.findByIdPinCommentIdInOrderByIdPinCommentIdAscPositionAsc(any()))
                .thenReturn(List.of(link));
        when(assets.findAllById(any())).thenReturn(List.of(attachment));
        when(approvals.findNewestFirst(reviewId, versionId)).thenReturn(List.of(approval));

        DiscussionResponse result = service.discussion(userId, reviewId, versionId);

        assertEquals(reviewId, result.reviewId());
        assertEquals(versionId, result.versionId());
        assertEquals(1, result.pins().size());
        assertEquals(2, result.pins().getFirst().commentCount());
        assertEquals(2, result.comments().size());
        assertEquals(pin.getId(), result.comments().getFirst().pinId());
        assertEquals(1, result.comments().getFirst().attachments().size());
        assertEquals(1, result.reviews().size());
        assertEquals("REVIEW", result.reviews().getFirst().kind());
        assertEquals(ReviewApproval.DECISION_APPROVED, result.reviews().getFirst().decision());
        assertEquals("Jan Nowak", result.reviews().getFirst().authorName());
    }

    @Test void reportsMissingPinAndComment() {
        UUID missingPin = UUID.randomUUID();
        when(pins.findByIdAndDeletedAtIsNull(missingPin)).thenReturn(Optional.empty());

        ResourceNotFoundException pinException = assertThrows(ResourceNotFoundException.class,
                () -> service.updatePin(userId, missingPin, new UpdatePinRequest("OPEN")));
        assertEquals("PIN_NOT_FOUND", pinException.getCode());

        ResourceNotFoundException commentException = assertThrows(ResourceNotFoundException.class,
                () -> service.deleteComment(userId, UUID.randomUUID()));
        assertEquals("COMMENT_NOT_FOUND", commentException.getCode());
    }

    @Test void listPinsRejectsVersionFromAnotherReview() {
        UUID otherVersionId = UUID.randomUUID();
        when(versions.findById(otherVersionId)).thenReturn(Optional.empty());

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.listPins(userId, reviewId, otherVersionId));

        assertEquals("VERSION_NOT_FOUND", exception.getCode());
    }

    @Test void commentResponseUsesUnknownNameForDeletedAuthor() {
        Pin pin = pin(userId);
        PinComment comment = comment(pin.getId(), UUID.randomUUID(), "Treść");
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByPinIdInOrderByCreatedAtAscIdAsc(any()))
                .thenReturn(List.of(comment));

        PinResponse response = service.updatePin(userId, pin.getId(), new UpdatePinRequest("OPEN"));

        assertEquals(1, response.comments().size());
        assertEquals("Usunięty użytkownik", response.comments().getFirst().authorName());
    }

    @Test void quantizesCoordinatesToThreeDecimalsHalfUp() {
        PinResponse response = service.createPin(userId, reviewId, versionId,
                new CreatePinRequest(12.3455, 44.2504, "Treść", List.of()));

        assertEquals(12.346, response.xPercent(), 0.0000001);
        assertEquals(44.250, response.yPercent(), 0.0000001);
    }

    @Test void rejectsMoreThanTenAttachments() {
        List<UUID> tooMany = new ArrayList<>();
        for (int index = 0; index < 11; index++) {
            tooMany.add(UUID.randomUUID());
        }

        InvalidRequestException pinException = assertThrows(InvalidRequestException.class,
                () -> service.createPin(userId, reviewId, versionId,
                        new CreatePinRequest(1.0, 1.0, "Treść", tooMany)));
        assertEquals("TOO_MANY_ATTACHMENTS", pinException.getCode());

        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        InvalidRequestException commentException = assertThrows(InvalidRequestException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest("Treść", null, tooMany)));
        assertEquals("TOO_MANY_ATTACHMENTS", commentException.getCode());
        verify(assets, never()).findAllById(any());
    }

    @Test void rejectsCommentsDeeperThanThreeLevels() {
        Pin pin = pin(userId);
        PinComment root = comment(pin.getId(), userId, "Poziom 1");
        PinComment second = new PinComment(pin.getId(), root.getId(), userId, "Poziom 2");
        PinComment third = new PinComment(pin.getId(), second.getId(), userId, "Poziom 3");
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByIdAndDeletedAtIsNull(third.getId())).thenReturn(Optional.of(third));
        when(comments.findById(second.getId())).thenReturn(Optional.of(second));
        when(comments.findById(root.getId())).thenReturn(Optional.of(root));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.addComment(userId, pin.getId(),
                        new CreateCommentRequest("Poziom 4", third.getId(), List.of())));

        assertEquals("COMMENT_DEPTH_EXCEEDED", exception.getCode());
        verify(comments, never()).saveAndFlush(any());
    }

    @Test void deletingParentKeepsReplyTreeWithRedactedTombstone() {
        Pin pin = pin(userId);
        PinComment parent = comment(pin.getId(), userId, "Rodzic");
        PinComment reply = new PinComment(
                pin.getId(), parent.getId(), otherUserId, "Odpowiedź");
        parent.onCreate();
        reply.onCreate();
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        when(comments.findByIdAndDeletedAtIsNull(parent.getId())).thenReturn(Optional.of(parent));

        service.deleteComment(userId, parent.getId());

        assertNotNull(parent.getDeletedAt());
        verify(realtime).commentDeleted(
                eq(projectId), eq(reviewId), eq(versionId), eq(pin.getId()),
                argThat(tombstone -> tombstone.deleted()
                        && tombstone.body().isEmpty()
                        && tombstone.attachments().isEmpty()));

        when(pins.findByReviewVersionIdAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(versionId))
                .thenReturn(List.of(pin));
        when(comments.findByPinIdInOrderByCreatedAtAscIdAsc(any()))
                .thenReturn(List.of(parent, reply));

        DiscussionResponse discussion = service.discussion(userId, reviewId, versionId);

        assertEquals(2, discussion.comments().size());
        CommentResponse parentResponse = discussion.comments().stream()
                .filter(comment -> comment.id().equals(parent.getId()))
                .findFirst().orElseThrow();
        CommentResponse replyResponse = discussion.comments().stream()
                .filter(comment -> comment.id().equals(reply.getId()))
                .findFirst().orElseThrow();
        assertTrue(parentResponse.deleted());
        assertEquals("", parentResponse.body());
        assertTrue(parentResponse.attachments().isEmpty());
        assertEquals(parent.getId(), replyResponse.parentCommentId());
        assertEquals("Odpowiedź", replyResponse.body());
        assertEquals(1, discussion.pins().getFirst().commentCount());
    }

    @Test void createPinAndAddCommentLockReviewBeforeStatusCheck() {
        service.createPin(userId, reviewId, versionId,
                new CreatePinRequest(1.0, 1.0, "Treść", List.of()));

        Pin pin = pin(userId);
        when(pins.findByIdAndDeletedAtIsNull(pin.getId())).thenReturn(Optional.of(pin));
        service.addComment(userId, pin.getId(),
                new CreateCommentRequest("Odpowiedź", null, List.of()));

        verify(reviews, times(2)).findByIdForUpdate(reviewId);
        verify(reviews, never()).findByIdAndDeletedAtIsNull(any());
    }

    private Pin pin(UUID createdBy) {
        return new Pin(versionId, imageAssetId, 10.0, 20.0, createdBy);
    }

    private PinComment comment(UUID pinId, UUID authorId, String body) {
        return new PinComment(pinId, null, authorId, body);
    }

    private WorkspaceMember member(UUID memberId, String role) {
        return new WorkspaceMember(workspaceId, memberId, role, userId);
    }

    private User user(String displayName) {
        User mock = mock(User.class);
        when(mock.getDisplayName()).thenReturn(displayName);
        return mock;
    }

    private Asset attachmentAsset(UUID assetProjectId) {
        UUID id = UUID.randomUUID();
        Asset asset = mock(Asset.class);
        when(asset.getId()).thenReturn(id);
        when(asset.getProjectId()).thenReturn(assetProjectId);
        when(asset.getPurpose()).thenReturn(Asset.PURPOSE_ATTACHMENT);
        when(asset.getStatus()).thenReturn(Asset.STATUS_READY);
        when(asset.getContentType()).thenReturn("image/png");
        when(asset.getOriginalName()).thenReturn("attachment.png");
        when(asset.getSizeBytes()).thenReturn(3L);
        when(asset.getWidth()).thenReturn(2);
        when(asset.getHeight()).thenReturn(2);
        when(asset.getCreatedAt()).thenReturn(Instant.now());
        when(assets.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(asset));
        return asset;
    }
}
