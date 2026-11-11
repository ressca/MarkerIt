package pl.markerit.api.storage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class AssetStorageResolverTest {

    @Test void resolvesProvidersCaseInsensitively() {
        StorageService s3 = mock(StorageService.class);
        StorageService local = mock(StorageService.class);
        when(s3.provider()).thenReturn("S3");
        when(local.provider()).thenReturn("LOCAL");

        var resolver = new AssetStorageResolver(List.of(s3, local));

        assertSame(s3, resolver.defaultStorage());
        assertSame(s3, resolver.forProvider("s3"));
        assertSame(local, resolver.forProvider(" local "));
    }

    @Test void rejectsUnknownProvider() {
        StorageService local = mock(StorageService.class);
        when(local.provider()).thenReturn("LOCAL");
        var resolver = new AssetStorageResolver(List.of(local));

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> resolver.forProvider("R2"));

        assertTrue(exception.getMessage().contains("R2"));
    }

    @Test void rejectsEmptyConfiguration() {
        assertThrows(IllegalStateException.class, () -> new AssetStorageResolver(List.of()));
    }
}
