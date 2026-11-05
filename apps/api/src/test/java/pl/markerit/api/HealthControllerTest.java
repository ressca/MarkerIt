package pl.markerit.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class HealthControllerTest {
    @Test void reportsHealthyStatus() {
        assertEquals("ok", new HealthController().health().status());
    }
}
