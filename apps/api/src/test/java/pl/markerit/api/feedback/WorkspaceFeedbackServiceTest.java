package pl.markerit.api.feedback;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.markerit.api.assets.Asset;
import pl.markerit.api.assets.AssetRepository;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectRepository;
import pl.markerit.api.reviews.Review;
import pl.markerit.api.reviews.ReviewRepository;
import pl.markerit.api.reviews.ReviewVersion;
import pl.markerit.api.reviews.ReviewVersionRepository;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceService;

class WorkspaceFeedbackServiceTest {

    private WorkspaceService workspaces;
    private ProjectRepository projects;
    private ReviewRepository reviews;
    private ReviewVersionRepository versions;
    private PinRepository pins;
    private PinCommentRepository comments;
    private UserRepository users;
    private AssetRepository assets;
    private WorkspaceFeedbackService service;

    private UUID userId;
    private UUID workspaceId;

    @BeforeEach void setUp() {
        workspaces = mock(WorkspaceService.class);
        projects = mock(ProjectRepository.class);
        reviews = mock(ReviewRepository.class);
        versions = mock(ReviewVersionRepository.class);
        pins = mock(PinRepository.class);
        comments = mock(PinCommentRepository.class);
        users = mock(UserRepository.class);
        assets = mock(AssetRepository.class);
        service = new WorkspaceFeedbackService(
                workspaces, projects, reviews, versions, pins, comments, users, assets);
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
    }

    @Test void listsLatestVersionFeedbackAcrossProjects() {
        Project firstProject = new Project(workspaceId, "Kampania", "kampania", null, "sage", userId);
        Project secondProject = new Project(workspaceId, "Opakowanie", "opakowanie", null, "blue", userId);
        Review firstReview = new Review(firstProject.getId(), "Baner", null, userId);
        Review secondReview = new Review(secondProject.getId(), "Etykieta", null, userId);
        secondReview.close(userId);
        ReviewVersion oldVersion = new ReviewVersion(firstReview.getId(), 1, null, userId);
        ReviewVersion latestVersion = new ReviewVersion(firstReview.getId(), 2, null, userId);
        ReviewVersion otherLatest = new ReviewVersion(secondReview.getId(), 1, null, userId);

        Pin newestPin = new Pin(latestVersion.getId(), UUID.randomUUID(), 12.5, 44, userId);
        Pin olderPin = new Pin(otherLatest.getId(), UUID.randomUUID(), 80, 20, userId);

        User author = user(userId, "Anna Kowalska");
        User commenter = user(UUID.randomUUID(), "Jan Nowak");
        Instant now = Instant.now();
        PinComment lastComment = comment(
                newestPin.getId(), commenter.getId(), "Skróć margines", now);
        PinComment firstComment = comment(
                newestPin.getId(), author.getId(), "Pierwsza uwaga", now.minusSeconds(60));
        PinComment otherComment = comment(
                olderPin.getId(), author.getId(), "Wyrównaj logo", now.minusSeconds(600));

        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "MEMBER", userId));
        when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId))
                .thenReturn(List.of(firstProject, secondProject));
        when(reviews.findByProjectIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(any()))
                .thenReturn(List.of(firstReview, secondReview));
        when(versions.findByReviewIdInOrderByReviewIdAscVersionNumberAsc(any()))
                .thenReturn(List.of(oldVersion, latestVersion, otherLatest));
        when(pins.findByReviewVersionIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(any()))
                .thenReturn(List.of(newestPin, olderPin));
        when(comments.findByPinIdInAndDeletedAtIsNullOrderByCreatedAtAscIdAsc(any()))
                .thenReturn(List.of(firstComment, lastComment, otherComment));
        when(users.findAllById(any())).thenReturn(List.of(author, commenter));
        Asset image = asset(newestPin.getAssetId());
        when(assets.findAllById(any())).thenReturn(List.of(image));

        var result = service.list(userId, workspaceId);

        assertEquals(2, result.size());
        var first = result.getFirst();
        assertEquals(newestPin.getId(), first.id());
        assertEquals("Kampania", first.projectName());
        assertEquals("Baner", first.reviewTitle());
        assertEquals(2, first.versionNumber());
        assertEquals("Anna Kowalska", first.authorName());
        assertEquals("AK", first.authorInitials());
        assertEquals(2, first.commentCount());
        assertEquals("Pierwsza uwaga", first.noteBody());
        assertEquals("Skróć margines", first.lastCommentBody());
        assertEquals("Jan Nowak", first.lastCommentAuthorName());
        assertEquals("JN", first.lastCommentAuthorInitials());
        assertEquals("sage", first.projectTone());
        assertEquals("OPEN", first.status());
        assertNotNull(first.asset());

        var second = result.get(1);
        assertEquals(olderPin.getId(), second.id());
        assertEquals("CLOSED", second.reviewStatus());
        assertEquals("blue", second.projectTone());
        assertNull(second.asset());

        verify(pins).findByReviewVersionIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                argThat(ids -> ids.size() == 2
                        && ids.contains(latestVersion.getId())
                        && ids.contains(otherLatest.getId())));
    }

    @Test void returnsEmptyListWhenWorkspaceHasNoProjects() {
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId))
                .thenReturn(List.of());

        assertTrue(service.list(userId, workspaceId).isEmpty());
        verifyNoInteractions(reviews, pins, comments, assets);
    }

    @Test void returnsEmptyListWhenProjectsHaveNoReviews() {
        Project project = new Project(workspaceId, "Projekt", "projekt", null, "sage", userId);
        when(workspaces.requireMember(workspaceId, userId))
                .thenReturn(new WorkspaceMember(workspaceId, userId, "OWNER", userId));
        when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(workspaceId))
                .thenReturn(List.of(project));
        when(reviews.findByProjectIdInAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(any()))
                .thenReturn(List.of());

        assertTrue(service.list(userId, workspaceId).isEmpty());
        verifyNoInteractions(versions, pins, comments, assets);
    }

    @Test void rejectsNonWorkspaceMember() {
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(ForbiddenAccessException.class, () -> service.list(userId, workspaceId));
        verifyNoInteractions(projects, reviews, pins, comments, assets);
    }

    private static User user(UUID id, String displayName) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        when(user.getDisplayName()).thenReturn(displayName);
        return user;
    }

    private static PinComment comment(
            UUID pinId, UUID authorId, String body, Instant createdAt) {
        PinComment comment = mock(PinComment.class);
        when(comment.getPinId()).thenReturn(pinId);
        when(comment.getAuthorId()).thenReturn(authorId);
        when(comment.getBody()).thenReturn(body);
        when(comment.getCreatedAt()).thenReturn(createdAt);
        return comment;
    }

    private static Asset asset(UUID id) {
        Asset asset = mock(Asset.class);
        when(asset.getId()).thenReturn(id);
        when(asset.getProjectId()).thenReturn(UUID.randomUUID());
        when(asset.getPurpose()).thenReturn(Asset.PURPOSE_REVIEW_IMAGE);
        when(asset.getContentType()).thenReturn("image/png");
        when(asset.getOriginalName()).thenReturn("projekt.png");
        when(asset.getSizeBytes()).thenReturn(1024L);
        when(asset.getWidth()).thenReturn(1200);
        when(asset.getHeight()).thenReturn(800);
        when(asset.getCreatedAt()).thenReturn(Instant.now());
        when(asset.getDeletedAt()).thenReturn(null);
        return asset;
    }
}
