package pl.markerit.api.users;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import pl.markerit.api.assets.AssetService;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.auth.PasswordPolicyException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.users.web.UpdateProfileRequest;

class ProfileServiceTest {

    private UserService users;
    private UserRepository repository;
    private PasswordEncoder passwords;
    private AssetService assets;
    private ProfileService service;
    private UUID userId;
    private User user;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        repository = mock(UserRepository.class);
        passwords = mock(PasswordEncoder.class);
        assets = mock(AssetService.class);
        service = new ProfileService(users, repository, passwords, assets);
        userId = UUID.randomUUID();
        user = new User("anna@example.com", "old-hash");
        user.setTimestamps();
        when(users.requireUser(userId)).thenReturn(user);
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test void returnsProfileWithInitialsAndAvatarUrl() {
        UUID avatarId = UUID.randomUUID();
        user.setAvatarAssetId(avatarId);

        var profile = service.getProfile(userId);

        assertEquals(user.getId(), profile.id());
        assertEquals("anna@example.com", profile.email());
        assertEquals("anna", profile.displayName());
        assertEquals("AN", profile.initials());
        assertEquals("pl", profile.locale());
        assertEquals(avatarId, profile.avatarAssetId());
        assertEquals("assets/" + avatarId + "/content", profile.avatarUrl());
    }

    @Test void updatesDisplayNameAndLocale() {
        var response = service.updateProfile(userId, new UpdateProfileRequest("  Anna Kowalska  ", "en"));

        assertEquals("Anna Kowalska", response.getDisplayName());
        assertEquals("AK", service.toResponse(response).initials());
        assertEquals("en", response.getLocale());
        verify(repository).save(user);
    }

    @Test void rejectsDisplayNameThatIsTooShortAfterTrimming() {
        assertThrows(InvalidRequestException.class,
                () -> service.updateProfile(userId, new UpdateProfileRequest("  x  ", null)));
        verify(repository, never()).save(any());
    }

    @Test void uploadsAvatarAndDeletesThePreviousOne() {
        UUID previousId = UUID.randomUUID();
        UUID uploadedId = UUID.randomUUID();
        user.setAvatarAssetId(previousId);
        when(assets.uploadAvatar(eq(userId), any())).thenReturn(assetResponse(uploadedId));

        User saved = service.updateAvatar(userId, null);

        assertEquals(uploadedId, saved.getAvatarAssetId());
        verify(repository).save(user);
        verify(assets).deleteAvatarAsset(previousId);
    }

    @Test void removesAvatarAndDeletesItsAsset() {
        UUID previousId = UUID.randomUUID();
        user.setAvatarAssetId(previousId);

        User saved = service.removeAvatar(userId);

        assertNull(saved.getAvatarAssetId());
        verify(assets).deleteAvatarAsset(previousId);
    }

    @Test void changingPasswordRequiresTheCurrentPassword() {
        when(users.verifyPassword(userId, "wrong")).thenReturn(false);

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.changePassword(userId, "wrong", "new-password"));

        assertEquals("CURRENT_PASSWORD_INVALID", exception.getCode());
        verify(passwords, never()).encode(anyString());
    }

    @Test void changesPasswordWhenTheCurrentPasswordMatches() {
        when(users.verifyPassword(userId, "current-password")).thenReturn(true);
        when(passwords.encode("new-password")).thenReturn("new-hash");

        service.changePassword(userId, "current-password", "new-password");

        assertEquals("new-hash", user.getPasswordHash());
        verify(repository).save(user);
    }

    @Test void rejectsPasswordLongerThan72Utf8Bytes() {
        String tooLong = "ą".repeat(37);
        assertTrue(tooLong.getBytes(StandardCharsets.UTF_8).length > 72);
        when(users.verifyPassword(userId, "current-password")).thenReturn(true);

        assertThrows(PasswordPolicyException.class,
                () -> service.changePassword(userId, "current-password", tooLong));
    }

    private static AssetResponse assetResponse(UUID id) {
        return new AssetResponse(
                id,
                null,
                "AVATAR",
                "image/png",
                "avatar.png",
                1024,
                512,
                512,
                "assets/" + id + "/content",
                null);
    }
}
