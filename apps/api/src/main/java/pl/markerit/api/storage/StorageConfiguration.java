package pl.markerit.api.storage;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class StorageConfiguration {

    @Bean(destroyMethod = "close")
    StorageService storageService(StorageProperties properties) {
        String provider = properties.provider();
        if (provider == null || provider.isBlank()) {
            throw new IllegalStateException(
                    "Storage configuration is incomplete: app.storage.provider must be set to S3, R2 or LOCAL.");
        }
        return switch (provider) {
            case "LOCAL" -> new LocalStorageService(properties);
            case "S3", "R2" -> {
                requireText(properties.bucket(), "app.storage.bucket", provider);
                yield new S3StorageService(properties);
            }
            default -> throw new IllegalStateException(
                    "Unsupported app.storage.provider '" + provider + "'. Use S3, R2 or LOCAL.");
        };
    }

    private static void requireText(String value, String property, String provider) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Storage configuration is incomplete: " + property + " must be set for provider " + provider + ".");
        }
    }
}
