package pl.markerit.api.storage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class S3StorageServiceTest {

    private S3Client client;
    private S3StorageService storage;

    @BeforeEach void setUp() {
        client = mock(S3Client.class);
        storage = new S3StorageService(properties("R2", "https://storage.example.com", "https://cdn.example.com/"), client);
    }

    @Test void putsObjectsWithBucketKeyAndContentType() {
        byte[] content = "image".getBytes(StandardCharsets.UTF_8);

        storage.putObject("projects/p1/image.png", new ByteArrayInputStream(content), content.length, "image/png");

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(client).putObject(request.capture(), any(RequestBody.class));
        assertEquals("markerit", request.getValue().bucket());
        assertEquals("projects/p1/image.png", request.getValue().key());
        assertEquals("image/png", request.getValue().contentType());
        assertEquals(content.length, request.getValue().contentLength().longValue());
    }

    @Test void readsObjectBytes() {
        byte[] content = "image".getBytes(StandardCharsets.UTF_8);
        when(client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), content));

        assertArrayEquals(content, storage.getObject("projects/p1/image.png"));

        ArgumentCaptor<GetObjectRequest> request = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(client).getObjectAsBytes(request.capture());
        assertEquals("markerit", request.getValue().bucket());
        assertEquals("projects/p1/image.png", request.getValue().key());
    }

    @Test void mapsMissingObjectToDomainException() {
        when(client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("missing").build());

        assertThrows(StorageObjectNotFoundException.class,
                () -> storage.getObject("projects/p1/missing.png"));
    }

    @Test void closesClient() {
        storage.close();

        verify(client).close();
    }

    @Test void deletesObjects() {
        storage.deleteObject("projects/p1/image.png");

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(request.capture());
        assertEquals("markerit", request.getValue().bucket());
        assertEquals("projects/p1/image.png", request.getValue().key());
    }

    @Test void buildsPublicUrlsFromConfiguredBase() {
        assertEquals("R2", storage.provider());
        assertEquals("https://cdn.example.com/projects/p1/image.png",
                storage.publicUrl("projects/p1/image.png"));
    }

    @Test void fallsBackToEndpointThenAwsUrl() {
        var endpointStorage = new S3StorageService(
                properties("S3", "https://minio:9000/", " "), mock(S3Client.class));
        assertEquals("https://minio:9000/markerit/a.png", endpointStorage.publicUrl("a.png"));
        assertEquals("S3", endpointStorage.provider());

        var awsStorage = new S3StorageService(
                properties("S3", null, null), mock(S3Client.class));
        assertEquals("https://markerit.s3.auto.amazonaws.com/a.png", awsStorage.publicUrl("a.png"));

        var defaultRegionStorage = new S3StorageService(new StorageProperties(
                "S3", null, "key", "secret", "markerit", " ", false, null, null), mock(S3Client.class));
        assertEquals("https://markerit.s3.us-east-1.amazonaws.com/a.png",
                defaultRegionStorage.publicUrl("a.png"));
    }

    @Test void publicConstructorBuildsClientWithoutNetworkCalls() {
        var service = new S3StorageService(properties("S3", "http://localhost:9000", null));
        assertEquals("S3", service.provider());
        assertEquals("http://localhost:9000/markerit/a.png", service.publicUrl("a.png"));
    }

    private static StorageProperties properties(String provider, String endpoint, String publicBaseUrl) {
        return new StorageProperties(
                provider,
                endpoint,
                "access-key",
                "secret-key",
                "markerit",
                "auto",
                true,
                publicBaseUrl,
                null);
    }
}
