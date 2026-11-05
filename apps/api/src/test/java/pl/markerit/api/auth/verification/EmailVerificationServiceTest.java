package pl.markerit.api.auth.verification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.users.UserService;

class EmailVerificationServiceTest {
    private UserService users;
    private UserRepository userRepository;
    private EmailVerificationCodeRepository codes;
    private ApplicationEventPublisher events;
    private EmailVerificationService service;
    private UUID userId;
    private User user;

    @BeforeEach void setUp() {
        users = mock(UserService.class);
        userRepository = mock(UserRepository.class);
        codes = mock(EmailVerificationCodeRepository.class);
        events = mock(ApplicationEventPublisher.class);
        service = new EmailVerificationService(users, userRepository, codes, events,
                "test-only-pepper-with-at-least-32-bytes");
        userId = UUID.randomUUID();
        user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(user.getEmail()).thenReturn("person@example.com");
        when(users.findByEmail("person@example.com")).thenReturn(Optional.of(user));
    }

    @Test void issuesHashedSixDigitCodeAndVerifiesIt() {
        AtomicReference<EmailVerificationCode> stored = new AtomicReference<>();
        when(codes.findById(userId)).thenAnswer(ignored -> Optional.ofNullable(stored.get()));
        when(codes.save(any(EmailVerificationCode.class))).thenAnswer(invocation -> {
            EmailVerificationCode code = invocation.getArgument(0);
            stored.set(code);
            return code;
        });

        var delivery = service.requestCode("person@example.com", true);
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(events).publishEvent(eventCaptor.capture());
        var emailEvent = (EmailVerificationService.VerificationEmailRequested) eventCaptor.getValue();

        assertEquals("person@example.com", emailEvent.recipient());
        assertTrue(emailEvent.polish());
        assertTrue(emailEvent.code().matches("[0-9]{6}"));
        assertNotEquals(emailEvent.code(), stored.get().getCodeHash());
        assertTrue(delivery.expiresAt().isAfter(delivery.resendAvailableAt()));

        assertEquals(EmailVerificationService.VerificationResult.VERIFIED,
                service.verify("person@example.com", emailEvent.code()));
        verify(user).verifyEmail();
        verify(userRepository).save(user);
        verify(codes).delete(stored.get());
    }

    @Test void rejectsIncorrectCodesAndLocksAfterFiveAttempts() {
        EmailVerificationCode stored = new EmailVerificationCode(userId, "not-the-hmac", Instant.now(), Instant.now().plusSeconds(600));
        when(codes.findById(userId)).thenReturn(Optional.of(stored));

        for (int attempt = 1; attempt < 5; attempt++) {
            assertEquals(EmailVerificationService.VerificationResult.INVALID, service.verify("person@example.com", "000000"));
        }
        assertEquals(EmailVerificationService.VerificationResult.LIMIT_REACHED, service.verify("person@example.com", "000000"));
        assertEquals(5, stored.getFailedAttempts());
    }

    @Test void expiresCodesAndEnforcesResendCooldownAndHourlyCap() {
        EmailVerificationCode expired = new EmailVerificationCode(userId, "hash", Instant.now().minusSeconds(1200), Instant.now().minusSeconds(600));
        when(codes.findById(userId)).thenReturn(Optional.of(expired));
        assertEquals(EmailVerificationService.VerificationResult.EXPIRED, service.verify("person@example.com", "123456"));
        verify(codes).delete(expired);

        EmailVerificationCode cooldown = new EmailVerificationCode(userId, "hash", Instant.now().minusSeconds(30), Instant.now().plusSeconds(600));
        when(codes.findById(userId)).thenReturn(Optional.of(cooldown));
        VerificationException waitError = assertThrows(VerificationException.class,
                () -> service.requestCode("person@example.com", false));
        assertEquals("OTP_RESEND_WAIT", waitError.getCode());
        assertTrue(waitError.getRetryAfterSeconds() > 0);

        Instant sentAt = Instant.now().minusSeconds(120);
        EmailVerificationCode hourlyCap = new EmailVerificationCode(userId, "hash", sentAt.minusSeconds(1800), sentAt.plusSeconds(600));
        for (int resend = 0; resend < 4; resend++) hourlyCap.resend("hash", sentAt, sentAt.plusSeconds(600));
        when(codes.findById(userId)).thenReturn(Optional.of(hourlyCap));
        VerificationException limitError = assertThrows(VerificationException.class,
                () -> service.requestCode("person@example.com", false));
        assertEquals("OTP_RESEND_LIMIT", limitError.getCode());
    }

    @Test void doesNotSendCodesForUnknownOrAlreadyVerifiedAddresses() {
        when(users.findByEmail("missing@example.com")).thenReturn(Optional.empty());
        service.requestCode("missing@example.com", false);
        when(user.isEmailVerified()).thenReturn(true);
        service.requestCode("person@example.com", false);
        verifyNoInteractions(events);
        verify(codes, never()).save(any());
    }
}
