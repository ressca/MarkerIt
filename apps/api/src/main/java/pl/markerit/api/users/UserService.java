package pl.markerit.api.users;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        String passwordHash = passwordEncoder.encode(rawPassword);
        return users.save(new User(normalizedEmail, passwordHash));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<User> findByEmail(String email) {
        return users.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
    }
}
