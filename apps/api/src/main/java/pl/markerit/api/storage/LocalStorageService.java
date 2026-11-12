package pl.markerit.api.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

public class LocalStorageService implements StorageService, AutoCloseable {

    private final Path root;

    public LocalStorageService(StorageProperties properties) {
        this(defaultRoot(properties.localDirectory()));
    }

    LocalStorageService(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public String provider() {
        return "LOCAL";
    }

    @Override
    public void putObject(String key, InputStream content, long size, String contentType) {
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not store local object: " + key, exception);
        }
    }

    @Override
    public byte[] getObject(String key) {
        Path target = resolve(key);
        if (!Files.exists(target)) {
            throw new StorageObjectNotFoundException(key);
        }
        try {
            return Files.readAllBytes(target);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read local object: " + key, exception);
        }
    }

    @Override
    public void deleteObject(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not delete local object: " + key, exception);
        }
    }

    @Override
    public String publicUrl(String key) {
        return resolve(key).toUri().toString();
    }

    @Override
    public void close() {
        // Nothing to release for local files.
    }

    Path resolve(String key) {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key: " + key);
        }
        return target;
    }

    private static Path defaultRoot(String configuredDirectory) {
        if (configuredDirectory != null && !configuredDirectory.isBlank()) {
            return Path.of(configuredDirectory);
        }
        return Path.of(System.getProperty("java.io.tmpdir"), "markerit-storage");
    }
}
