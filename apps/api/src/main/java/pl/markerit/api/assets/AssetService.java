package pl.markerit.api.assets;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.common.ConflictException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.common.LimitReachedException;
import pl.markerit.api.common.ResourceNotFoundException;
import pl.markerit.api.projects.Project;
import pl.markerit.api.projects.ProjectService;
import pl.markerit.api.storage.AssetStorageResolver;
import pl.markerit.api.storage.StorageObjectNotFoundException;
import pl.markerit.api.storage.StorageService;
import pl.markerit.api.workspaces.WorkspaceService;

@Service
public class AssetService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AssetService.class);

    public static final int MAX_REVIEW_IMAGES_PER_PROJECT = 8;
    public static final long MAX_ASSET_SIZE_BYTES = 10L * 1024 * 1024;
    public static final long MAX_AVATAR_SIZE_BYTES = 5L * 1024 * 1024;
    public static final long MAX_IMAGE_PIXELS = 80_000_000L;
    public static final int MAX_IMAGE_DIMENSION = 12_000;

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/png", "image/jpeg");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg");
    private static final int MAX_ORIGINAL_NAME_LENGTH = 255;
    private static final int COPY_BUFFER_SIZE = 8192;
    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };

    private final AssetRepository assets;
    private final ProjectService projects;
    private final WorkspaceService workspaces;
    private final AssetStorageResolver storages;

    public AssetService(
            AssetRepository assets,
            ProjectService projects,
            WorkspaceService workspaces,
            AssetStorageResolver storages) {
        this.assets = assets;
        this.projects = projects;
        this.workspaces = workspaces;
        this.storages = storages;
    }

    @Transactional
    public AssetResponse upload(UUID userId, UUID projectId, MultipartFile file) {
        return upload(userId, projectId, file, Asset.PURPOSE_REVIEW_IMAGE);
    }

    /**
     * Uploads a comment attachment. Any workspace member who may take part in a
     * review (including VIEWER) can add attachments; attachments do not consume
     * the project's review image quota.
     */
    @Transactional
    public AssetResponse uploadAttachment(UUID userId, UUID projectId, MultipartFile file) {
        return upload(userId, projectId, file, Asset.PURPOSE_ATTACHMENT);
    }

    @Transactional
    public AssetResponse uploadAvatar(UUID userId, MultipartFile file) {
        validate(file, MAX_AVATAR_SIZE_BYTES, true);
        String contentType = normalizeContentType(file.getContentType());
        String originalName = normalizeOriginalName(file.getOriginalFilename());
        StagedFile staged = stage(file, MAX_AVATAR_SIZE_BYTES, true);
        try {
            if (staged.size() == 0) {
                throw new InvalidRequestException("EMPTY_FILE", "Wybierz plik do przesłania.");
            }
            validateActualContent(staged.path(), contentType);
            ImageDimensions dimensions = readDimensions(staged.path());

            StorageService storage = storages.defaultStorage();
            String storageKey = "avatars/" + userId + "/" + UUID.randomUUID()
                    + "." + EXTENSIONS.get(contentType);
            try (InputStream content = Files.newInputStream(staged.path())) {
                storage.putObject(storageKey, content, staged.size(), contentType);
            }
            deleteOnRollback(storage, storageKey);

            Asset asset = Asset.avatar(
                    userId,
                    storage.provider(),
                    storageKey,
                    originalName,
                    contentType,
                    staged.size(),
                    dimensions.width(),
                    dimensions.height(),
                    Map.of("originalName", originalName),
                    staged.checksumSha256());
            try {
                return toResponse(assets.saveAndFlush(asset));
            } catch (RuntimeException exception) {
                deleteQuietly(storage, storageKey);
                throw exception;
            }
        } catch (IOException exception) {
            throw new InvalidRequestException("INVALID_FILE", "Nie udało się odczytać pliku.");
        } finally {
            deleteQuietly(staged.path());
        }
    }

    /**
     * Hard-deletes an avatar row and its object. The calling profile service is
     * responsible for clearing the user reference first.
     */
    @Transactional
    public void deleteAvatarAsset(UUID assetId) {
        Asset asset = requireAsset(assetId);
        if (!Asset.PURPOSE_AVATAR.equals(asset.getPurpose())) {
            return;
        }
        assets.delete(asset);
        assets.flush();
        StorageService storage = storages.forProvider(asset.getStorageProvider());
        afterCommitOrNow(() -> deleteStoredObject(storage, asset.getStorageKey()));
    }

    private AssetResponse upload(UUID userId, UUID projectId, MultipartFile file, String purpose) {
        Project project = projects.requireProject(projectId);
        boolean reviewImage = Asset.PURPOSE_REVIEW_IMAGE.equals(purpose);
        if (reviewImage) {
            workspaces.requireProjectManager(project.getWorkspaceId(), userId);
            if (Project.STATUS_CLOSED.equals(project.getStatus())) {
                throw new ConflictException(
                        "PROJECT_CLOSED",
                        "Projekt jest zamknięty. Otwórz projekt, aby dodawać zdjęcia.");
            }
        } else {
            workspaces.requireMember(project.getWorkspaceId(), userId);
        }
        validate(file, MAX_ASSET_SIZE_BYTES, false);

        if (reviewImage
                && assets.countByProjectIdAndPurposeAndDeletedAtIsNull(projectId, Asset.PURPOSE_REVIEW_IMAGE)
                >= MAX_REVIEW_IMAGES_PER_PROJECT) {
            throw assetLimitReached();
        }

        String contentType = normalizeContentType(file.getContentType());
        String originalName = normalizeOriginalName(file.getOriginalFilename());
        StagedFile staged = stage(file, MAX_ASSET_SIZE_BYTES, false);
        try {
            if (staged.size() == 0) {
                throw new InvalidRequestException("EMPTY_FILE", "Wybierz plik do przesłania.");
            }
            validateActualContent(staged.path(), contentType);
            ImageDimensions dimensions = readDimensions(staged.path());

            StorageService storage = storages.defaultStorage();
            String folder = reviewImage ? "" : "attachments/";
            String storageKey = "projects/" + projectId + "/" + folder + UUID.randomUUID()
                    + "." + EXTENSIONS.get(contentType);
            try (InputStream content = Files.newInputStream(staged.path())) {
                storage.putObject(storageKey, content, staged.size(), contentType);
            }
            deleteOnRollback(storage, storageKey);

            Asset asset = reviewImage
                    ? new Asset(
                            project.getWorkspaceId(),
                            projectId,
                            userId,
                            storage.provider(),
                            storageKey,
                            originalName,
                            contentType,
                            staged.size(),
                            dimensions.width(),
                            dimensions.height(),
                            Map.of("originalName", originalName),
                            staged.checksumSha256())
                    : Asset.attachment(
                            project.getWorkspaceId(),
                            projectId,
                            userId,
                            storage.provider(),
                            storageKey,
                            originalName,
                            contentType,
                            staged.size(),
                            dimensions.width(),
                            dimensions.height(),
                            Map.of("originalName", originalName),
                            staged.checksumSha256());

            try {
                return toResponse(assets.saveAndFlush(asset));
            } catch (DataIntegrityViolationException exception) {
                deleteQuietly(storage, storageKey);
                if (reviewImage && isAssetLimitViolation(exception)) {
                    throw assetLimitReached();
                }
                throw exception;
            } catch (RuntimeException exception) {
                deleteQuietly(storage, storageKey);
                throw exception;
            }
        } catch (IOException exception) {
            throw new InvalidRequestException("INVALID_FILE", "Nie udało się odczytać pliku.");
        } finally {
            deleteQuietly(staged.path());
        }
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> list(UUID userId, UUID projectId) {
        Project project = projects.requireProject(projectId);
        workspaces.requireMember(project.getWorkspaceId(), userId);
        return assets.findByProjectIdAndPurposeAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
                        projectId, Asset.PURPOSE_REVIEW_IMAGE).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetContent content(UUID userId, UUID assetId) {
        Asset asset = requireAsset(assetId);
        // Avatars are intentionally visible to every authenticated user (for
        // example in workspace member lists). They are not tied to a workspace.
        if (!Asset.PURPOSE_AVATAR.equals(asset.getPurpose())) {
            workspaces.requireMember(asset.getWorkspaceId(), userId);
        }
        byte[] data;
        try {
            data = storages.forProvider(asset.getStorageProvider()).getObject(asset.getStorageKey());
        } catch (StorageObjectNotFoundException exception) {
            throw new ResourceNotFoundException("ASSET_CONTENT_NOT_FOUND", "Nie znaleziono pliku.");
        }
        return new AssetContent(
                asset.getId(),
                data,
                asset.getContentType(),
                asset.getOriginalName(),
                asset.getChecksumSha256());
    }

    @Transactional
    public void delete(UUID userId, UUID assetId) {
        Asset asset = requireAsset(assetId);
        boolean referenced = assets.isReferencedByReviewVersion(assetId)
                || assets.isReferencedByPinCommentAttachment(assetId);
        // Any workspace member (including VIEWER) may discard an attachment
        // they uploaded themselves, as long as it is not referenced yet. This
        // keeps best-effort cleanup after a failed comment submission working
        // without granting viewers broader asset-delete permissions.
        boolean ownUnreferencedAttachment = Asset.PURPOSE_ATTACHMENT.equals(asset.getPurpose())
                && userId.equals(asset.getOwnerUserId())
                && !referenced;
        boolean ownAvatar = Asset.PURPOSE_AVATAR.equals(asset.getPurpose())
                && userId.equals(asset.getOwnerUserId());
        if (!ownUnreferencedAttachment && !ownAvatar) {
            workspaces.requireProjectManager(asset.getWorkspaceId(), userId);
        }

        if (referenced) {
            throw assetInUse();
        }

        try {
            assets.delete(asset);
            assets.flush();
        } catch (DataIntegrityViolationException exception) {
            throw assetInUse();
        }

        StorageService storage = storages.forProvider(asset.getStorageProvider());
        afterCommitOrNow(() -> deleteStoredObject(storage, asset.getStorageKey()));
    }

    @Transactional(readOnly = true)
    public Asset requireAsset(UUID assetId) {
        return assets.findByIdAndDeletedAtIsNull(assetId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ASSET_NOT_FOUND",
                        "Nie znaleziono pliku."));
    }

    private void validate(MultipartFile file, long maxBytes, boolean avatar) {
        if (file == null || file.isEmpty()) {
            throw new InvalidRequestException("EMPTY_FILE", "Wybierz plik do przesłania.");
        }
        if (file.getSize() > maxBytes) {
            throw avatar ? avatarTooLarge() : assetTooLarge();
        }
        if (!ALLOWED_CONTENT_TYPES.contains(normalizeContentType(file.getContentType()))) {
            throw new InvalidRequestException(
                    "UNSUPPORTED_CONTENT_TYPE",
                    "Dozwolone formaty to PNG i JPEG.");
        }
    }

    private void validateActualContent(Path file, String declaredContentType) throws IOException {
        String actualContentType = detectContentType(file);
        if (actualContentType == null) {
            throw invalidImage();
        }
        if (!actualContentType.equals(declaredContentType)) {
            throw new InvalidRequestException(
                    "CONTENT_TYPE_MISMATCH",
                    "Zadeklarowany typ pliku nie zgadza się z jego zawartością.");
        }
    }

    private String detectContentType(Path file) throws IOException {
        byte[] header = new byte[12];
        int read;
        try (InputStream input = Files.newInputStream(file)) {
            read = input.readNBytes(header, 0, header.length);
        }
        if (read >= PNG_SIGNATURE.length && startsWith(header, PNG_SIGNATURE)) {
            return "image/png";
        }
        if (read >= 3
                && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xFF) == 0xD8
                && (header[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }

    private static boolean startsWith(byte[] value, byte[] prefix) {
        for (int index = 0; index < prefix.length; index++) {
            if (value[index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private StagedFile stage(MultipartFile file, long maxBytes, boolean avatar) {
        Path temp = null;
        try {
            temp = Files.createTempFile("markerit-upload-", ".tmp");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = 0;
            InputStream raw = file.getInputStream();
            if (raw == null) {
                throw new IOException("Multipart stream is not available.");
            }
            try (InputStream input = new DigestInputStream(raw, digest);
                    OutputStream output = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[COPY_BUFFER_SIZE];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    size += read;
                    if (size > maxBytes) {
                        throw avatar ? avatarTooLarge() : assetTooLarge();
                    }
                    output.write(buffer, 0, read);
                }
            }
            return new StagedFile(temp, size, HexFormat.of().formatHex(digest.digest()));
        } catch (InvalidRequestException exception) {
            deleteQuietly(temp);
            throw exception;
        } catch (IOException | NoSuchAlgorithmException exception) {
            deleteQuietly(temp);
            throw new InvalidRequestException("INVALID_FILE", "Nie udało się odczytać pliku.");
        }
    }

    private ImageDimensions readDimensions(Path file) {
        try (ImageInputStream input = ImageIO.createImageInputStream(file.toFile())) {
            if (input == null) {
                throw invalidImage();
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalidImage();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0) {
                    throw invalidImage();
                }
                long pixels = (long) width * height;
                if (width > MAX_IMAGE_DIMENSION
                        || height > MAX_IMAGE_DIMENSION
                        || pixels > MAX_IMAGE_PIXELS) {
                    throw new InvalidRequestException(
                            "IMAGE_TOO_LARGE",
                            "Obraz może mieć maksymalnie 80 megapikseli i 12000 pikseli na bok.");
                }
                return new ImageDimensions(width, height);
            } finally {
                reader.dispose();
            }
        } catch (InvalidRequestException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalidImage();
        }
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) return "";
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeOriginalName(String originalName) {
        if (originalName == null) return "plik";
        String cleaned = originalName.trim()
                .replaceAll("\\p{Cntrl}", "")
                .replace('\\', '_')
                .replace('/', '_');
        if (cleaned.isBlank()) return "plik";
        if (cleaned.length() <= MAX_ORIGINAL_NAME_LENGTH) {
            return cleaned;
        }
        int dot = cleaned.lastIndexOf('.');
        if (dot > 0 && cleaned.length() - dot <= 20) {
            String extension = cleaned.substring(dot);
            return cleaned.substring(0, MAX_ORIGINAL_NAME_LENGTH - extension.length()) + extension;
        }
        return cleaned.substring(0, MAX_ORIGINAL_NAME_LENGTH);
    }

    private boolean isAssetLimitViolation(DataIntegrityViolationException exception) {
        String message = exception.getMostSpecificCause().getMessage();
        return message != null && message.contains("ASSET_LIMIT_REACHED");
    }

    private void deleteOnRollback(StorageService storage, String storageKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != TransactionSynchronization.STATUS_COMMITTED) {
                    deleteQuietly(storage, storageKey);
                }
            }
        });
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
                    "Nie udało się usunąć pliku {} z magazynu po usunięciu assetu. "
                            + "Obiekt wymaga ręcznego czyszczenia.",
                    storageKey,
                    exception);
        }
    }

    private void deleteQuietly(StorageService storage, String storageKey) {
        try {
            storage.deleteObject(storageKey);
        } catch (RuntimeException ignored) {
            // Best-effort cleanup; the primary operation error is more useful.
        }
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Temporary files are cleaned up by the OS if this fails.
        }
    }

    private InvalidRequestException assetTooLarge() {
        return new InvalidRequestException("ASSET_TOO_LARGE", "Plik może mieć maksymalnie 10 MB.");
    }

    private InvalidRequestException avatarTooLarge() {
        return new InvalidRequestException("AVATAR_TOO_LARGE", "Avatar może mieć maksymalnie 5 MB.");
    }

    private LimitReachedException assetLimitReached() {
        return new LimitReachedException(
                "ASSET_LIMIT_REACHED",
                "Projekt może mieć maksymalnie 8 obrazów do recenzji.");
    }

    private InvalidRequestException invalidImage() {
        return new InvalidRequestException(
                "INVALID_IMAGE",
                "Przesłany plik nie jest prawidłowym obrazem PNG lub JPEG.");
    }

    private ConflictException assetInUse() {
        return new ConflictException(
                "ASSET_IN_USE",
                "Nie można usunąć pliku, który jest używany w recenzji lub komentarzu.");
    }

    private AssetResponse toResponse(Asset asset) {
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

    private record ImageDimensions(int width, int height) {
    }

    private record StagedFile(Path path, long size, String checksumSha256) {
    }
}
