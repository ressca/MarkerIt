package pl.markerit.api.auth.verification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.users.UserService;

class EmailChangeServiceTest {

    private UserService users;
    private UserRepository userRepository;
    private EmailChangeRequestRepository requests;
    private ApplicationEventPublisher events;
    private EmailChangeService service;
    private UUID userId;
    private User user;
    private AtomicReference<EmailChangeRequest> stored;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        userRepository = mock(UserRepository.class);
        requests = mock(EmailChangeRequestRepository.class);
        events = mock(ApplicationEventPublisher.class);
        service = new EmailChangeService(
                users, userRepository, requests, events, "pepper-with-at-least-32-characters-long");
        userId = UUID.randomUUID();
        user = mock(User.class);
        when(user.getEmail()).thenReturn("anna@example.com");
        stored = new AtomicReference<>();
        when(users.requireUser(userId)).thenReturn(user);
        when(users.verifyPassword(userId, "current-password")).thenReturn(true);
        when(requests.findById(userId)).thenAnswer(call -> Optional.ofNullable(stored.get()));
        when(requests.save(any(EmailChangeRequest.class))).thenAnswer(call -> {
            EmailChangeRequest request = call.getArgument(0);
            stored.set(request);
            return request;
        });
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test void requestsCodeForTheNewAddressAndRequiresCurrentPassword() {
        var delivery = service.request(userId, "New@Example.com ", "current-password", true);

        assertEquals("new@example.com", delivery.email());
        assertNotNull(stored.get());
        assertEquals("new@example.com", stored.get().getNewEmail());

        ArgumentCaptor<EmailChangeService.EmailChangeEmailRequested> event =
                ArgumentCaptor.forClass(EmailChangeService.EmailChangeEmailRequested.class);
        verify(events).publishEvent(event.capture());
        assertEquals("new@example.com", event.getValue().recipient());
        assertTrue(event.getValue().code().matches("\\d{6}"));
        assertTrue(event.getValue().polish());
    }

    @Test void rejectsRequestWithIncorrectPassword() {
        when(users.verifyPassword(userId, "wrong")).thenReturn(false);

        InvalidRequestException exception = assertThrows(InvalidRequestException.class,
                () -> service.request(userId, "new@example.com", "wrong", false));

        assertEquals("CURRENT_PASSWORD_INVALID", exception.getCode());
        verify(requests, never()).save(any());
        verifyNoInteractions(events);
    }

    @Test void rejectsUnchangedEmailAndExistingAccount() {
        InvalidRequestException unchanged = assertThrows(InvalidRequestException.class,
                () -> service.request(userId, " ANNA@example.com ", "current-password", false));
        assertEquals("EMAIL_UNCHANGED", unchanged.getCode());

        when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);
        assertThrows(EmailAlreadyRegisteredException.class,
                () -> service.request(userId, "taken@example.com", "current-password", false));
    }

    @Test void enforcesResendCooldownForRepeatedRequests() {
        service.request(userId, "new@example.com", "current-password", false);

        VerificationException exception = assertThrows(VerificationException.class,
                () -> service.request(userId, "new@example.com", "current-password", false));

        assertEquals("OTP_RESEND_WAIT", exception.getCode());
    }

    @Test void verifiesCodeAndChangesEmail() {
        var delivery = service.request(userId, "new@example.com", "current-password", false);
        String code = publishedCode();

        var result = service.verify(userId, delivery.email(), code);

        assertEquals(EmailChangeService.VerificationResult.VERIFIED, result);
        verify(user).changeEmail("new@example.com");
        verify(userRepository).save(user);
        verify(requests).delete(stored.get());
    }

    @Test void rejectsInvalidCodeAndCountsTheAttempt() {
        var delivery = service.request(userId, "new@example.com", "current-password", false);
        String wrongCode = "000000".equals(publishedCode()) ? "111111" : "000000";

        var result = service.verify(userId, delivery.email(), wrongCode);

        assertEquals(EmailChangeService.VerificationResult.INVALID, result);
        assertEquals(1, stored.get().getFailedAttempts());
        verify(user, never()).changeEmail(anyString());
    }

    @Test void reportsExpiredAndMissingRequests() {
        stored.set(new EmailChangeRequest(
                userId,
                "new@example.com",
                "hash",
                Instant.now().minusSeconds(120),
                Instant.now().minusSeconds(60)));

        assertEquals(
                EmailChangeService.VerificationResult.EXPIRED,
                service.verify(userId, "new@example.com", "123456"));

        stored.set(null);
        assertEquals(
                EmailChangeService.VerificationResult.INVALID,
                service.verify(userId, "new@example.com", "123456"));
    }

    @Test void resendsToThePendingAddress() {
        service.request(userId, "new@example.com", "current-password", false);
        stored.get().resend(
                "new@example.com", "old-hash", Instant.now().minusSeconds(120),
                Instant.now().plusSeconds(60));

        var delivery = service.resend(userId, false);

        assertEquals("new@example.com", delivery.email());
        verify(events, times(2)).publishEvent(any(EmailChangeService.EmailChangeEmailRequested.class));
    }

    private String publishedCode() {
        ArgumentCaptor<EmailChangeService.EmailChangeEmailRequested> event =
                ArgumentCaptor.forClass(EmailChangeService.EmailChangeEmailRequested.class);
        verify(events, atLeastOnce()).publishEvent(event.capture());
        return event.getValue().code();
    }
}
