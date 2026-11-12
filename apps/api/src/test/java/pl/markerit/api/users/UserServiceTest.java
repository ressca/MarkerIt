package pl.markerit.api.users;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.auth.PasswordPolicyException;
import pl.markerit.api.common.ResourceNotFoundException;

class UserServiceTest {
    private UserRepository users;
    private PasswordEncoder passwords;
    private UserService service;

    @BeforeEach void setUp() {
        users = mock(UserRepository.class);
        passwords = mock(PasswordEncoder.class);
        when(passwords.encode(anyString())).thenReturn("dummy-hash");
        service = new UserService(users, passwords);
    }

    @Test void createsUserWithNormalizedEmailAndEncodedPassword() {
        when(users.existsByEmail("person@example.com")).thenReturn(false);
        when(passwords.encode("a-long-password")).thenReturn("encoded");
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User created = service.createUser(" Person@Example.com ", "a-long-password");

        assertEquals("person@example.com", created.getEmail());
        verify(passwords).encode("a-long-password");
        verify(users).save(created);
    }

    @Test void rejectsDuplicateEmailBeforeEncoding() {
        when(users.existsByEmail("person@example.com")).thenReturn(true);
        assertThrows(EmailAlreadyRegisteredException.class,
                () -> service.createUser("Person@example.com", "a-long-password"));
        verify(passwords, never()).matches(anyString(), anyString());
        verify(users, never()).save(any());
    }

    @Test void rejectsPasswordLongerThan72Utf8Bytes() {
        String password = "ą".repeat(37);
        assertTrue(password.getBytes(StandardCharsets.UTF_8).length > 72);
        assertThrows(PasswordPolicyException.class, () -> service.createUser("a@b.com", password));
    }

    @Test void authenticatesNormalizedEmailWhenPasswordMatches() {
        User user = mock(User.class);
        when(users.findByEmail("person@example.com")).thenReturn(Optional.of(user));
        when(user.getPasswordHash()).thenReturn("encoded");
        when(passwords.matches("password", "encoded")).thenReturn(true);
        assertSame(user, service.authenticate(" Person@Example.com ", "password").orElseThrow());
    }

    @Test void returnsEmptyForUnknownUserOrIncorrectPassword() {
        when(users.findByEmail("missing@example.com")).thenReturn(Optional.empty());
        assertTrue(service.authenticate("missing@example.com", "password").isEmpty());
        verify(passwords).matches(eq("password"), argThat(hash -> !"encoded".equals(hash)));
        User user = mock(User.class);
        when(users.findByEmail("person@example.com")).thenReturn(Optional.of(user));
        when(user.getPasswordHash()).thenReturn("encoded");
        when(passwords.matches("wrong", "encoded")).thenReturn(false);
        assertTrue(service.authenticate("person@example.com", "wrong").isEmpty());
    }

    @Test void verifiesPasswordsWithoutCallingBcryptForOverlongInput() {
        UUID userId = UUID.randomUUID();
        User user = mock(User.class);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(user.getPasswordHash()).thenReturn("encoded");
        when(passwords.matches("correct", "encoded")).thenReturn(true);

        assertTrue(service.verifyPassword(userId, "correct"));
        assertFalse(service.verifyPassword(userId, "ą".repeat(37)));
        verify(passwords).matches("correct", "encoded");
    }

    @Test void reportsMissingUsers() {
        UUID userId = UUID.randomUUID();
        when(users.findById(userId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.requireUser(userId));
    }
}
