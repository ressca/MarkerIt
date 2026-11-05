package pl.markerit.api.users;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.PasswordPolicyException;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String unknownUserPasswordHash;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.unknownUserPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
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
        java.util.Optional<User> user = users.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
        String passwordHash = user.map(User::getPasswordHash).orElse(unknownUserPasswordHash);
        boolean passwordMatches = passwordEncoder.matches(rawPassword, passwordHash);
        return user.filter(ignored -> passwordMatches);
    }

    @Transactional(readOnly = true)
    public java.util.Optional<User> findByEmail(String email) {
        return users.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<User> findById(java.util.UUID id) {
        return users.findById(id);
    }
}
