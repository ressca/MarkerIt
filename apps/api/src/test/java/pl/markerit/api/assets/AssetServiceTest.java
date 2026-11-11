package pl.markerit.api.assets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.ForbiddenAccessException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.storage.AssetStorageResolver;
import pl.markerit.api.storage.StorageObjectNotFoundException;
import pl.markerit.api.storage.StorageService;
import pl.markerit.api.workspaces.WorkspaceMember;
import pl.markerit.api.workspaces.WorkspaceService;

class AssetServiceTest {

    private AssetRepository assets;
    private ProjectService projects;
    private WorkspaceService workspaces;
    private StorageService storage;
    private StorageService localStorage;
    private AssetService service;
    private UUID userId;
    private UUID workspaceId;
    private UUID projectId;
    private Project project;
    private WorkspaceMember member;

    @BeforeEach void setUp() {
        assets = mock(AssetRepository.class);
        projects = mock(ProjectService.class);
        workspaces = mock(WorkspaceService.class);
        storage = mock(StorageService.class);
        localStorage = mock(StorageService.class);
        when(storage.provider()).thenReturn("S3");
        when(localStorage.provider()).thenReturn("LOCAL");
        service = new AssetService(assets, projects, workspaces,
                new AssetStorageResolver(List.of(storage, localStorage)));
        userId = UUID.randomUUID();
        workspaceId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        project = mock(Project.class);
        member = new WorkspaceMember(workspaceId, userId, "MEMBER", userId);

        when(project.getWorkspaceId()).thenReturn(workspaceId);
        when(projects.requireProject(projectId)).thenReturn(project);
        when(workspaces.requireProjectManager(workspaceId, userId)).thenReturn(member);
        when(assets.saveAndFlush(any(Asset.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test void uploadsReviewImageWithDimensionsAndStorageKey() throws IOException {
        byte[] content = png(2, 3);
        var file = new MockMultipartFile("file", "shot.png", "image/png", content);

        AssetResponse response = service.upload(userId, projectId, file);

        assertEquals(projectId, response.projectId());
        assertEquals(Asset.PURPOSE_REVIEW_IMAGE, response.purpose());
        assertEquals("image/png", response.contentType());
        assertEquals("shot.png", response.originalName());
        assertEquals(content.length, response.sizeBytes());
        assertEquals(2, response.width());
        assertEquals(3, response.height());
        assertEquals("assets/" + response.id() + "/content", response.url());

        verify(storage).putObject(
                startsWith("projects/" + projectId + "/"),
                any(InputStream.class),
                eq((long) content.length),
                eq("image/png"));
        verify(assets).saveAndFlush(argThat(asset ->
                workspaceId.equals(asset.getWorkspaceId())
                        && projectId.equals(asset.getProjectId())
                        && userId.equals(asset.getOwnerUserId())
                        && "S3".equals(asset.getStorageProvider())
                        && Asset.STATUS_READY.equals(asset.getStatus())
                        && asset.getChecksumSha256() != null
                        && asset.getChecksumSha256().length() == 64
                        && "shot.png".equals(asset.getMetadata().get("originalName"))));
        verify(workspaces).requireProjectManager(workspaceId, userId);
    }

    @Test void acceptsJpegWithJpgExtension() throws IOException {
        byte[] content = jpeg(1, 1);
        var file = new MockMultipartFile("file", "photo.jpeg", "image/jpeg", content);

        AssetResponse response = service.upload(userId, projectId, file);

        assertEquals("image/jpeg", response.contentType());
        verify(storage).putObject(endsWith(".jpg"), any(InputStream.class), anyLong(), eq("image/jpeg"));
    }

    @Test void rejectsWebpUntilAByteValidatorIsAvailable() {
        var file = new MockMultipartFile("file", "shot.webp", "image/webp", new byte[] {1, 2});

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("UNSUPPORTED_CONTENT_TYPE", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void rejectsMalformedImage() {
        var file = new MockMultipartFile("file", "shot.png", "image/png",
                "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("INVALID_IMAGE", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void rejectsContentTypeThatDoesNotMatchBytes() throws IOException {
        var file = new MockMultipartFile("file", "shot.png", "image/png", jpeg(1, 1));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("CONTENT_TYPE_MISMATCH", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void rejectsUploadWhenProjectAlreadyHasEightImages() throws IOException {
        when(assets.countByProjectIdAndPurposeAndDeletedAtIsNull(projectId, Asset.PURPOSE_REVIEW_IMAGE))
                .thenReturn(8L);

        LimitReachedException exception = assertThrows(LimitReachedException.class,
                () -> service.upload(userId, projectId,
                        new MockMultipartFile("file", "shot.png", "image/png", png(1, 1))));

        assertEquals("ASSET_LIMIT_REACHED", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
        verify(assets, never()).saveAndFlush(any());
    }

    @Test void rejectsUnsupportedContentType() {
        var file = new MockMultipartFile("file", "doc.pdf", "application/pdf", new byte[] {1, 2});

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("UNSUPPORTED_CONTENT_TYPE", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void rejectsEmptyFile() {
        var file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("EMPTY_FILE", exception.getCode());
    }

    @Test void rejectsFileLargerThanTenMegabytes() {
        var file = new MockMultipartFile("file", "big.png", "image/png",
                new byte[(int) AssetService.MAX_ASSET_SIZE_BYTES + 1]);

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("ASSET_TOO_LARGE", exception.getCode());
    }

    @Test void rejectsUnreadableFile() throws IOException {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(4L);
        when(file.getContentType()).thenReturn("image/png");
        when(file.getOriginalFilename()).thenReturn("shot.png");
        when(file.getInputStream()).thenThrow(new IOException("broken"));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("INVALID_FILE", exception.getCode());
    }

    @Test void removesStoredObjectWhenDatabaseSaveFails() throws IOException {
        when(assets.saveAndFlush(any(Asset.class))).thenThrow(new DataIntegrityViolationException("limit"));

        assertThrows(DataIntegrityViolationException.class,
                () -> service.upload(userId, projectId,
                        new MockMultipartFile("file", "shot.png", "image/png", png(1, 1))));

        verify(storage).deleteObject(startsWith("projects/" + projectId + "/"));
    }

    @Test void mapsConcurrentAssetLimitViolationToLimitError() throws IOException {
        var exception = new DataIntegrityViolationException(
                "could not execute statement",
                new IllegalStateException("ERROR: ASSET_LIMIT_REACHED"));
        when(assets.saveAndFlush(any(Asset.class))).thenThrow(exception);

        LimitReachedException thrown = assertThrows(LimitReachedException.class,
                () -> service.upload(userId, projectId,
                        new MockMultipartFile("file", "shot.png", "image/png", png(1, 1))));

        assertEquals("ASSET_LIMIT_REACHED", thrown.getCode());
        verify(storage).deleteObject(startsWith("projects/" + projectId + "/"));
    }

    @Test void requiresProjectManagerRoleForUpload() {
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(ForbiddenAccessException.class,
                () -> service.upload(userId, projectId,
                        new MockMultipartFile("file", "shot.png", "image/png", new byte[] {1})));
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void reportsMissingProject() {
        UUID missing = UUID.randomUUID();
        when(projects.requireProject(missing))
                .thenThrow(new ResourceNotFoundException("PROJECT_NOT_FOUND", "Brak projektu."));

        assertThrows(ResourceNotFoundException.class,
                () -> service.upload(userId, missing,
                        new MockMultipartFile("file", "shot.png", "image/png", new byte[] {1})));
    }

    @Test void listsProjectReviewImages() {
        Asset asset = asset(UUID.randomUUID());

        when(assets.findByProjectIdAndPurposeAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                projectId, Asset.PURPOSE_REVIEW_IMAGE)).thenReturn(List.of(asset));

        List<AssetResponse> response = service.list(userId, projectId);

        assertEquals(1, response.size());
        assertEquals(asset.getId(), response.getFirst().id());
        assertEquals("shot.png", response.getFirst().originalName());
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void returnsAssetContent() {
        Asset asset = asset(UUID.randomUUID());
        byte[] content = {1, 2, 3};
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(storage.getObject(asset.getStorageKey())).thenReturn(content);

        AssetContent response = service.content(userId, asset.getId());

        assertArrayEquals(content, response.data());
        assertEquals(asset.getId(), response.id());
        assertEquals("image/png", response.contentType());
        assertEquals("shot.png", response.originalName());
        assertEquals("checksum", response.checksumSha256());
        verify(workspaces).requireMember(workspaceId, userId);
    }

    @Test void resolvesStorageProviderRecordedOnAsset() {
        Asset asset = asset(UUID.randomUUID());
        when(asset.getStorageProvider()).thenReturn("LOCAL");
        byte[] content = {7, 8, 9};
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(localStorage.getObject(asset.getStorageKey())).thenReturn(content);

        AssetContent response = service.content(userId, asset.getId());

        assertArrayEquals(content, response.data());
        verify(localStorage).getObject(asset.getStorageKey());
        verify(storage, never()).getObject(anyString());
    }

    @Test void mapsMissingStoredObjectToNotFound() {
        Asset asset = asset(UUID.randomUUID());
        String storageKey = asset.getStorageKey();
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(storage.getObject(storageKey))
                .thenThrow(new StorageObjectNotFoundException(storageKey));

        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> service.content(userId, asset.getId()));

        assertEquals("ASSET_CONTENT_NOT_FOUND", exception.getCode());
    }

    @Test void rejectsUnconfiguredStorageProvider() {
        Asset asset = asset(UUID.randomUUID());
        when(asset.getStorageProvider()).thenReturn("R2");
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));

        assertThrows(IllegalStateException.class, () -> service.content(userId, asset.getId()));
    }

    @Test void reportsMissingAssetForContent() {
        UUID assetId = UUID.randomUUID();
        when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.content(userId, assetId));
    }

    @Test void forbidsContentForNonMember() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(workspaces.requireMember(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(ForbiddenAccessException.class, () -> service.content(userId, asset.getId()));
        verify(storage, never()).getObject(anyString());
    }

    @Test void deletesUnreferencedAssetAndStoredObject() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(assets.isReferencedByReviewVersion(asset.getId())).thenReturn(false);

        service.delete(userId, asset.getId());

        verify(assets).delete(asset);
        verify(assets).flush();
        verify(storage).deleteObject(asset.getStorageKey());
        verify(workspaces).requireProjectManager(workspaceId, userId);
    }

    @Test void refusesToDeleteAssetUsedByReview() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(assets.isReferencedByReviewVersion(asset.getId())).thenReturn(true);

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.delete(userId, asset.getId()));

        assertEquals("ASSET_IN_USE", exception.getCode());
        verify(assets, never()).delete(any());
        verify(storage, never()).deleteObject(anyString());
    }

    @Test void refusesDeleteForViewer() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(workspaces.requireProjectManager(workspaceId, userId))
                .thenThrow(new ForbiddenAccessException("WORKSPACE_FORBIDDEN", "Brak dostępu."));

        assertThrows(ForbiddenAccessException.class, () -> service.delete(userId, asset.getId()));
        verify(assets, never()).delete(any());
        verify(storage, never()).deleteObject(anyString());
    }

    @Test void translatesForeignKeyViolationDuringDelete() {
        Asset asset = asset(UUID.randomUUID());
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(assets.isReferencedByReviewVersion(asset.getId())).thenReturn(false);
        doThrow(new DataIntegrityViolationException("restrict")).when(assets).flush();

        ConflictException exception = assertThrows(ConflictException.class,
                () -> service.delete(userId, asset.getId()));

        assertEquals("ASSET_IN_USE", exception.getCode());
        verify(storage, never()).deleteObject(anyString());
    }

    @Test void reportsMissingAssetForDelete() {
        UUID assetId = UUID.randomUUID();
        when(assets.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.delete(userId, assetId));
    }

    @Test void surfacesStorageDeleteFailure() {
        Asset asset = asset(UUID.randomUUID());
        String storageKey = asset.getStorageKey();
        when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
        when(assets.isReferencedByReviewVersion(asset.getId())).thenReturn(false);
        doThrow(new IllegalStateException("S3 down")).when(storage).deleteObject(storageKey);

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> service.delete(userId, asset.getId()));

        assertTrue(exception.getMessage().contains("Nie udało się usunąć pliku"));
    }

    @Test void acceptsContentTypeWithParameters() throws IOException {
        var file = new MockMultipartFile("file", "shot.png", "image/png; charset=binary", png(1, 1));

        AssetResponse response = service.upload(userId, projectId, file);

        assertEquals("image/png", response.contentType());
    }

    @Test void rejectsImageExceedingDimensionCap() throws IOException {
        var file = new MockMultipartFile("file", "wide.png", "image/png",
                png(AssetService.MAX_IMAGE_DIMENSION + 1, 1));

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.upload(userId, projectId, file));

        assertEquals("IMAGE_TOO_LARGE", exception.getCode());
        verify(storage, never()).putObject(anyString(), any(), anyLong(), anyString());
    }

    @Test void cleansUpStoredObjectWhenTransactionRollsBack() throws IOException {
        TransactionSynchronizationManager.initSynchronization();
        try {
            when(assets.saveAndFlush(any(Asset.class))).thenThrow(new IllegalStateException("boom"));

            assertThrows(IllegalStateException.class,
                    () -> service.upload(userId, projectId,
                            new MockMultipartFile("file", "shot.png", "image/png", png(1, 1))));

            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

            verify(storage, times(2)).deleteObject(startsWith("projects/" + projectId + "/"));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test void deletesStoredObjectOnlyAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        try {
            Asset asset = asset(UUID.randomUUID());
            String storageKey = asset.getStorageKey();
            when(assets.findByIdAndDeletedAtIsNull(asset.getId())).thenReturn(Optional.of(asset));
            when(assets.isReferencedByReviewVersion(asset.getId())).thenReturn(false);

            service.delete(userId, asset.getId());

            verify(storage, never()).deleteObject(storageKey);
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit);
            verify(storage).deleteObject(storageKey);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test void normalizesOriginalFilename() throws IOException {
        String name = "a/../" + "x".repeat(300) + ".png";
        var file = new MockMultipartFile("file", name, "image/png", png(1, 1));

        AssetResponse response = service.upload(userId, projectId, file);

        assertTrue(response.originalName().length() <= 255);
        assertFalse(response.originalName().contains("/"));
        assertTrue(response.originalName().endsWith(".png"));
    }

    private Asset asset(UUID id) {
        Asset asset = mock(Asset.class);
        when(asset.getId()).thenReturn(id);
        when(asset.getProjectId()).thenReturn(projectId);
        when(asset.getWorkspaceId()).thenReturn(workspaceId);
        when(asset.getPurpose()).thenReturn(Asset.PURPOSE_REVIEW_IMAGE);
        when(asset.getStorageProvider()).thenReturn("S3");
        when(asset.getContentType()).thenReturn("image/png");
        when(asset.getSizeBytes()).thenReturn(3L);
        when(asset.getStorageKey()).thenReturn("projects/" + projectId + "/" + id + ".png");
        when(asset.getOriginalName()).thenReturn("shot.png");
        when(asset.getChecksumSha256()).thenReturn("checksum");
        when(asset.getCreatedAt()).thenReturn(Instant.now());
        return asset;
    }

    private static byte[] png(int width, int height) throws IOException {
        return image(width, height, "png");
    }

    private static byte[] jpeg(int width, int height) throws IOException {
        return image(width, height, "jpg");
    }

    private static byte[] image(int width, int height, String format) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, format, output);
        return output.toByteArray();
    }
}
