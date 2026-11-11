package pl.markerit.api.storage;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySourcesPropertyResolver;
import org.springframework.core.io.ClassPathResource;

class StoragePropertiesTest {

    @Test void applicationYamlProvidesMinioDefaults() throws IOException {
        var sources = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yaml"));
        var propertySources = new MutablePropertySources();
        sources.forEach(propertySources::addLast);
        var resolver = new PropertySourcesPropertyResolver(propertySources);

        assertEquals("S3", resolver.getProperty("app.storage.provider"));
        assertEquals("http://localhost:9000", resolver.getProperty("app.storage.endpoint"));
        assertEquals("minioadmin", resolver.getProperty("app.storage.access-key"));
        assertEquals("minioadmin", resolver.getProperty("app.storage.secret-key"));
        assertEquals("markerit", resolver.getProperty("app.storage.bucket"));
        assertEquals("us-east-1", resolver.getProperty("app.storage.region"));
        assertEquals("true", resolver.getProperty("app.storage.path-style"));
        assertEquals("http://localhost:9000/markerit", resolver.getProperty("app.storage.public-base-url"));
        assertEquals("10MB", resolver.getProperty("spring.servlet.multipart.max-file-size"));
    }

    @Test void normalizesProviderAndTrimsValues() {
        var properties = new StorageProperties(
                " r2 ", " https://r2.example.com ", " key ", " secret ", " bucket ",
                " auto ", true, " ", " ");

        assertEquals("R2", properties.provider());
        assertEquals("https://r2.example.com", properties.endpoint());
        assertEquals("key", properties.accessKey());
        assertEquals("secret", properties.secretKey());
        assertEquals("bucket", properties.bucket());
        assertEquals("auto", properties.region());
        assertNull(properties.publicBaseUrl());
        assertNull(properties.localDirectory());
    }

    @Test void rejectsIncompleteCredentials() {
        assertThrows(IllegalStateException.class, () -> new StorageProperties(
                "S3", null, "key", null, "bucket", "us-east-1", true, null, null));
    }

    @Test void doesNotLeakSecretsInToString() {
        var properties = new StorageProperties(
                "S3", "http://localhost:9000", "access-key", "super-secret", "bucket",
                "us-east-1", true, null, null);

        String rendered = properties.toString();

        assertFalse(rendered.contains("super-secret"));
        assertFalse(rendered.contains("access-key"));
        assertTrue(rendered.contains("secretKey=***"));
    }
}
