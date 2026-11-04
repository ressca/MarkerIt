package pl.markerit.api.users;

import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.PasswordPolicyException;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User createUser(String email, String rawPassword) {
        String normalizedEmail = email.trim().toLowerCase(java.util.Locale.ROOT);
        if (users.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }
        if (rawPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new PasswordPolicyException("The password cannot exceed 72 UTF-8 bytes.");
        }
        String passwordHash = passwordEncoder.encode(rawPassword);
        return users.save(new User(normalizedEmail, passwordHash));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<User> authenticate(String email, String rawPassword) {
        return users.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT))
                .filter(user -> passwordEncoder.matches(rawPassword, user.getPasswordHash()));
    }
}
