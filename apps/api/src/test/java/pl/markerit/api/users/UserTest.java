package pl.markerit.api.users;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class UserTest {
    @Test void assignsIdentityAndTimestampsOnPersistence() {
        User user = new User("person@example.com", "encoded-password");
        assertNotNull(user.getId());
        user.setTimestamps();
        assertNotNull(user.getCreatedAt());
        assertEquals(user.getCreatedAt(), user.getCreatedAt());
        assertEquals("person@example.com", user.getEmail());
    }
}
