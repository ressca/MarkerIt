package pl.markerit.api.users;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.assets.AssetService;
import pl.markerit.api.assets.web.AssetResponse;
import pl.markerit.api.auth.PasswordPolicyException;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.users.web.UpdateProfileRequest;
import pl.markerit.api.users.web.UserProfileResponse;

@Service
public class ProfileService {

    private final UserService users;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AssetService assets;
    private final AuthSessionService sessions;

    public ProfileService(
            UserService users,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AssetService assets,
            AuthSessionService sessions) {
        this.users = users;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.assets = assets;
        this.sessions = sessions;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        return toResponse(users.requireUser(userId));
    }

    @Transactional(readOnly = true)
    public User requireUser(UUID userId) {
        return users.requireUser(userId);
    }

    @Transactional
    public User updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = users.requireUser(userId);
        if (request.displayName() != null) {
            String displayName = request.displayName().trim();
            if (displayName.length() < 2) {
                throw new InvalidRequestException(
                        "INVALID_DISPLAY_NAME",
                        "Nazwa wyświetlana musi mieć co najmniej 2 znaki.");
            }
            user.updateDisplayName(displayName);
        }
        if (request.locale() != null) {
            user.updateLocale(request.locale());
        }
        return userRepository.save(user);
    }

    @Transactional
    public User updateAvatar(UUID userId, MultipartFile file) {
        User user = users.requireUserForUpdate(userId);
        UUID previousAvatarId = user.getAvatarAssetId();
        AssetResponse uploaded = assets.uploadAvatar(userId, file);
        user.setAvatarAssetId(uploaded.id());
        User saved = userRepository.save(user);
        if (previousAvatarId != null && !previousAvatarId.equals(uploaded.id())) {
            assets.deleteAvatarAsset(previousAvatarId);
        }
        return saved;
    }

    @Transactional
    public User removeAvatar(UUID userId) {
        User user = users.requireUserForUpdate(userId);
        UUID previousAvatarId = user.getAvatarAssetId();
        user.setAvatarAssetId(null);
        User saved = userRepository.save(user);
        if (previousAvatarId != null) {
            assets.deleteAvatarAsset(previousAvatarId);
        }
        return saved;
    }

    /**
     * Changes the password and revokes every other active session in the same
     * transaction. Returns the revoked session ids so the caller can close
     * their realtime connections after the commit.
     */
    @Transactional
    public List<UUID> changePassword(
            UUID userId, UUID currentSessionId, String currentPassword, String newPassword) {
        User user = users.requireUser(userId);
        if (!users.verifyPassword(userId, currentPassword)) {
            throw new InvalidRequestException(
                    "CURRENT_PASSWORD_INVALID",
                    "Aktualne hasło jest nieprawidłowe.");
        }
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new PasswordPolicyException("The password cannot exceed 72 UTF-8 bytes.");
        }
        user.changePasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return sessions.revokeOtherSessions(userId, currentSessionId);
    }

    public UserProfileResponse toResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                initials(user.getDisplayName()),
                user.getLocale(),
                user.getAvatarAssetId(),
                user.getAvatarAssetId() == null
                        ? null
                        : "assets/" + user.getAvatarAssetId() + "/content",
                user.getCreatedAt());
    }

    private static String initials(String displayName) {
        String[] parts = displayName.trim().split("\\s+");
        if (parts.length == 0 || parts[0].isBlank()) return "U";
        if (parts.length == 1) {
            String part = parts[0];
            return part.length() >= 2
                    ? part.substring(0, 2).toUpperCase(Locale.ROOT)
                    : part.substring(0, 1).toUpperCase(Locale.ROOT);
        }
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1))
                .toUpperCase(Locale.ROOT);
    }
}
