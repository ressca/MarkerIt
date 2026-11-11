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
        assertEquals("person", user.getDisplayName());
        assertEquals("pl", user.getLocale());
        assertEquals("encoded-password", user.getPasswordHash());
        assertNotNull(user.getUpdatedAt());
        assertNull(user.getAvatarAssetId());
        assertNull(user.getLastSeenAt());
        assertNull(user.getDeletedAt());
        assertFalse(user.isEmailVerified());
    }

    @Test void verifiesEmailAndTracksLastSeen() {
        User user = new User("person@example.com", "encoded-password");
        user.verifyEmail();
        assertTrue(user.isEmailVerified());
        user.touchLastSeen();
        assertNotNull(user.getLastSeenAt());
        assertEquals(user.getLastSeenAt(), user.getUpdatedAt());
        user.updateProfile(" ", "", null);
        assertEquals("person", user.getDisplayName());
        assertEquals("pl", user.getLocale());
    }

    @Test void updatesProfileAndSoftDeletes() {
        User user = new User("person@example.com", "encoded-password");
        java.util.UUID avatarId = java.util.UUID.randomUUID();
        user.updateProfile("Anna Kowalska", "en", avatarId);
        assertEquals("Anna Kowalska", user.getDisplayName());
        assertEquals("en", user.getLocale());
        assertEquals(avatarId, user.getAvatarAssetId());
        user.softDelete();
        assertNotNull(user.getDeletedAt());
    }
}
