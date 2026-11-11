package pl.markerit.api.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class StorageConfigurationTest {

    @Test void createsLocalStorageWithoutNetworkCalls() {
        runner("local").run(context -> {
            assertThat(context).hasSingleBean(StorageService.class);
            assertThat(context.getBean(StorageService.class)).isInstanceOf(LocalStorageService.class);
        });
    }

    @Test void createsS3StorageForS3AndR2CaseInsensitively() {
        for (String provider : new String[] {"S3", "s3", "R2", "r2"}) {
            runner(provider).run(context -> {
                assertThat(context).hasSingleBean(StorageService.class);
                assertThat(context.getBean(StorageService.class)).isInstanceOf(S3StorageService.class);
            });
        }
    }

    @Test void rejectsUnknownProvider() {
        runner("GCS").run(context -> {
            assertThat(context).hasFailed();
            assertThat(rootCause(context.getStartupFailure()).getMessage())
                    .contains("Unsupported app.storage.provider");
        });
    }

    @Test void rejectsMissingProvider() {
        runner(null).run(context -> {
            assertThat(context).hasFailed();
            assertThat(rootCause(context.getStartupFailure()).getMessage())
                    .contains("app.storage.provider must be set");
        });
    }

    @Test void rejectsS3WithoutBucket() {
        new ApplicationContextRunner()
                .withUserConfiguration(StorageConfiguration.class)
                .withBean(StorageProperties.class, () -> new StorageProperties(
                        "S3", "http://localhost:9000", "key", "secret", " ",
                        "us-east-1", true, null, null))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(rootCause(context.getStartupFailure()).getMessage())
                            .contains("app.storage.bucket must be set");
                });
    }

    private ApplicationContextRunner runner(String provider) {
        return new ApplicationContextRunner()
                .withUserConfiguration(StorageConfiguration.class)
                .withBean(StorageProperties.class, () -> new StorageProperties(
                        provider, "http://localhost:9000", "key", "secret", "markerit",
                        "us-east-1", true, null, null));
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable result = throwable;
        while (result.getCause() != null) {
            result = result.getCause();
        }
        return result;
    }
}
