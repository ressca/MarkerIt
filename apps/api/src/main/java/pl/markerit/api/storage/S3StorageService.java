package pl.markerit.api.storage;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

public class S3StorageService implements StorageService, AutoCloseable {

    private static final Duration API_CALL_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration API_CALL_ATTEMPT_TIMEOUT = Duration.ofSeconds(10);

    private final StorageProperties properties;
    private final S3Client client;
    private final String provider;

    public S3StorageService(StorageProperties properties) {
        this(properties, buildClient(properties));
    }

    S3StorageService(StorageProperties properties, S3Client client) {
        this.properties = properties;
        this.client = client;
        this.provider = normalizeProvider(properties.provider());
    }

    @Override
    public String provider() {
        return provider;
    }

    @Override
    public void putObject(String key, InputStream content, long size, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(key)
                .contentType(contentType)
                .contentLength(size)
                .build();
        client.putObject(request, RequestBody.fromInputStream(content, size));
    }

    @Override
    public byte[] getObject(String key) {
        try {
            ResponseBytes<GetObjectResponse> response = client.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(key)
                    .build());
            return response.asByteArray();
        } catch (NoSuchKeyException exception) {
            throw new StorageObjectNotFoundException(key);
        }
    }

    @Override
    public void deleteObject(String key) {
        client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.bucket())
                .key(key)
                .build());
    }

    @Override
    public String publicUrl(String key) {
        String base = properties.publicBaseUrl();
        if (base == null || base.isBlank()) {
            base = defaultBaseUrl();
        }
        return stripTrailingSlash(base) + "/" + key;
    }

    @Override
    public void close() {
        client.close();
    }

    private String defaultBaseUrl() {
        String endpoint = properties.endpoint();
        if (endpoint != null && !endpoint.isBlank()) {
            return stripTrailingSlash(endpoint) + "/" + properties.bucket();
        }
        return "https://" + properties.bucket() + ".s3." + region(properties) + ".amazonaws.com";
    }

    private static S3Client buildClient(StorageProperties properties) {
        var builder = S3Client.builder()
                .region(region(properties))
                .credentialsProvider(credentials(properties))
                .forcePathStyle(properties.pathStyle())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(API_CALL_TIMEOUT)
                        .apiCallAttemptTimeout(API_CALL_ATTEMPT_TIMEOUT)
                        .build());
        if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
            builder.endpointOverride(URI.create(properties.endpoint()));
        }
        return builder.build();
    }

    private static AwsCredentialsProvider credentials(StorageProperties properties) {
        if (isBlank(properties.accessKey()) || isBlank(properties.secretKey())) {
            return DefaultCredentialsProvider.builder().build();
        }
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey()));
    }

    private static Region region(StorageProperties properties) {
        return isBlank(properties.region()) ? Region.US_EAST_1 : Region.of(properties.region());
    }

    private static String normalizeProvider(String value) {
        return "R2".equalsIgnoreCase(value == null ? "" : value.trim()) ? "R2" : "S3";
    }

    private static String stripTrailingSlash(String value) {
        String trimmed = value.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
