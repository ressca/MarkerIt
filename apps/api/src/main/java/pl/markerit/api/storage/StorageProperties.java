package pl.markerit.api.storage;

import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        String provider,
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String region,
        boolean pathStyle,
        String publicBaseUrl,
        String localDirectory) {

    public StorageProperties {
        provider = normalizeProvider(provider);
        endpoint = trimToNull(endpoint);
        accessKey = trimToNull(accessKey);
        secretKey = trimToNull(secretKey);
        bucket = trimToNull(bucket);
        region = trimToNull(region);
        publicBaseUrl = trimToNull(publicBaseUrl);
        localDirectory = trimToNull(localDirectory);
        if ((accessKey == null) != (secretKey == null)) {
            throw new IllegalStateException(
                    "Storage configuration is incomplete: app.storage.access-key and app.storage.secret-key must be set together.");
        }
    }

    /**
     * Normalizes the provider so configuration is case-insensitive.
     */
    public static String normalizeProvider(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Override
    public String toString() {
        return "StorageProperties[provider=" + provider
                + ", endpoint=" + endpoint
                + ", accessKey=" + mask(accessKey)
                + ", secretKey=***"
                + ", bucket=" + bucket
                + ", region=" + region
                + ", pathStyle=" + pathStyle
                + ", publicBaseUrl=" + publicBaseUrl
                + ", localDirectory=" + localDirectory
                + "]";
    }

    private static String mask(String value) {
        return value == null ? null : "***";
    }
}
