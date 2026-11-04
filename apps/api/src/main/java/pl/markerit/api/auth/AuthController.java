package pl.markerit.api.auth;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserService;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService users;

    public AuthController(UserService users) {
        this.users = users;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisteredUser register(@Valid @RequestBody RegisterRequest request) {
        User user = users.createUser(request.email(), request.password());
        return new RegisteredUser(user.getId(), user.getEmail(), user.getCreatedAt());
    }

    public record RegisteredUser(UUID id, String email, Instant createdAt) {
    }
}
