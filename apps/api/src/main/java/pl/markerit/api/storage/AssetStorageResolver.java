package pl.markerit.api.storage;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Resolves the storage backend recorded on an asset instead of assuming the
 * currently configured provider can read every object.
 */
@Component
public class AssetStorageResolver {

    private final Map<String, StorageService> storages;
    private final StorageService defaultStorage;

    public AssetStorageResolver(List<StorageService> services) {
        if (services == null || services.isEmpty()) {
            throw new IllegalStateException("No StorageService bean is configured.");
        }
        Map<String, StorageService> byProvider = new LinkedHashMap<>();
        for (StorageService service : services) {
            byProvider.putIfAbsent(normalize(service.provider()), service);
        }
        this.storages = Map.copyOf(byProvider);
        this.defaultStorage = services.getFirst();
    }

    public StorageService defaultStorage() {
        return defaultStorage;
    }

    public StorageService forProvider(String provider) {
        StorageService service = storages.get(normalize(provider));
        if (service == null) {
            throw new IllegalStateException(
                    "Storage provider '" + provider + "' is not configured in this environment.");
        }
        return service;
    }

    private static String normalize(String provider) {
        return provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT);
    }
}
