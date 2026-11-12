package pl.markerit.api.storage;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalStorageServiceTest {

    @TempDir
    Path directory;

    @Test void storesReadsAndDeletesObjects() {
        var storage = new LocalStorageService(directory);
        byte[] content = "image-bytes".getBytes(StandardCharsets.UTF_8);

        storage.putObject("projects/p1/image.png", new ByteArrayInputStream(content), content.length, "image/png");

        assertEquals("LOCAL", storage.provider());
        assertArrayEquals(content, storage.getObject("projects/p1/image.png"));
        assertTrue(storage.publicUrl("projects/p1/image.png").startsWith("file:"));

        storage.deleteObject("projects/p1/image.png");

        assertThrows(StorageObjectNotFoundException.class, () -> storage.getObject("projects/p1/image.png"));
    }

    @Test void deletingMissingObjectIsSafe() {
        var storage = new LocalStorageService(directory);
        assertDoesNotThrow(() -> storage.deleteObject("missing.png"));
        assertDoesNotThrow(storage::close);
    }

    @Test void rejectsKeysEscapingTheRootDirectory() {
        var storage = new LocalStorageService(directory);
        assertThrows(IllegalArgumentException.class, () -> storage.getObject("../secret.txt"));
    }

    @Test void usesConfiguredDirectoryAndFallsBackToTempDirectory() {
        var configured = new LocalStorageService(new StorageProperties(
                "LOCAL", null, null, null, "bucket", null, false, null, directory.toString()));
        configured.putObject("a.txt", new ByteArrayInputStream(new byte[] {1}), 1, "text/plain");
        assertArrayEquals(new byte[] {1}, configured.getObject("a.txt"));

        var fallback = new LocalStorageService(new StorageProperties(
                "LOCAL", null, null, null, "bucket", null, false, null, null));
        assertEquals("LOCAL", fallback.provider());
    }
}
