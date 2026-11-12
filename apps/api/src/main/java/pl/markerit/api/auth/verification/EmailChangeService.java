package pl.markerit.api.auth.verification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.auth.EmailAlreadyRegisteredException;
import pl.markerit.api.common.InvalidRequestException;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.users.UserService;

/**
 * Sends and verifies the one-time code used to move an account to a new email
 * address. The code always goes to the requested new address; the current
 * password is required before a request is created.
 */
@Service
public class EmailChangeService {
    private static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofMinutes(1);
    private static final Duration SEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_SENDS_PER_WINDOW = 5;
    private static final int MAX_FAILED_ATTEMPTS = 5;

    private final UserService users;
    private final UserRepository userRepository;
    private final EmailChangeRequestRepository requests;
    private final ApplicationEventPublisher events;
    private final byte[] pepper;
    private final SecureRandom secureRandom = new SecureRandom();

    public EmailChangeService(
            UserService users,
            UserRepository userRepository,
            EmailChangeRequestRepository requests,
            ApplicationEventPublisher events,
            @Value("${app.security.email-otp-pepper}") String pepper) {
        if (pepper.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("EMAIL_OTP_PEPPER must contain at least 32 UTF-8 bytes.");
        }
        this.users = users;
        this.userRepository = userRepository;
        this.requests = requests;
        this.events = events;
        this.pepper = pepper.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public Delivery request(UUID userId, String newEmail, String currentPassword, boolean polish) {
        User user = users.requireUser(userId);
        if (!users.verifyPassword(userId, currentPassword)) {
            throw new InvalidRequestException(
                    "CURRENT_PASSWORD_INVALID",
                    "Aktualne hasło jest nieprawidłowe.");
        }

        String normalizedEmail = normalizeEmail(newEmail);
        if (normalizedEmail.equals(user.getEmail())) {
            throw new InvalidRequestException(
                    "EMAIL_UNCHANGED",
                    "Nowy adres e-mail jest taki sam jak obecny.");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }

        Instant now = Instant.now();
        Optional<EmailChangeRequest> previous = requests.findById(userId);
        enforceResendLimits(previous, now);

        String code = newCode();
        String hash = hash(userId.toString(), code);
        EmailChangeRequest request = previous
                .map(existing -> {
                    existing.resend(
                            normalizedEmail, hash, now, now.plus(CODE_LIFETIME));
                    return existing;
                })
                .orElseGet(() -> new EmailChangeRequest(
                        userId,
                        normalizedEmail,
                        hash,
                        now,
                        now.plus(CODE_LIFETIME)));
        requests.save(request);
        events.publishEvent(new EmailChangeEmailRequested(normalizedEmail, code, polish));
        return new Delivery(normalizedEmail, now.plus(RESEND_COOLDOWN), now.plus(CODE_LIFETIME));
    }

    @Transactional
    public Delivery resend(UUID userId, boolean polish) {
        users.requireUser(userId);
        EmailChangeRequest request = requests.findById(userId)
                .orElseThrow(() -> new InvalidRequestException(
                        "EMAIL_CHANGE_NOT_REQUESTED",
                        "Najpierw rozpocznij zmianę adresu e-mail."));
        if (userRepository.existsByEmail(request.getNewEmail())) {
            throw new EmailAlreadyRegisteredException();
        }

        Instant now = Instant.now();
        enforceResendLimits(Optional.of(request), now);

        String code = newCode();
        request.resend(request.getNewEmail(), hash(userId.toString(), code), now, now.plus(CODE_LIFETIME));
        requests.save(request);
        events.publishEvent(new EmailChangeEmailRequested(request.getNewEmail(), code, polish));
        return new Delivery(
                request.getNewEmail(), now.plus(RESEND_COOLDOWN), now.plus(CODE_LIFETIME));
    }

    @Transactional
    public VerificationResult verify(UUID userId, String newEmail, String suppliedCode) {
        User user = users.requireUser(userId);
        String normalizedEmail = normalizeEmail(newEmail);
        Optional<EmailChangeRequest> stored = requests.findById(userId);
        if (stored.isEmpty()) {
            return VerificationResult.INVALID;
        }
        EmailChangeRequest request = stored.get();
        Instant now = Instant.now();
        if (!request.getNewEmail().equals(normalizedEmail)) {
            return VerificationResult.INVALID;
        }
        if (!request.getExpiresAt().isAfter(now)) {
            requests.delete(request);
            return VerificationResult.EXPIRED;
        }
        if (request.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            return VerificationResult.LIMIT_REACHED;
        }
        if (!MessageDigest.isEqual(
                hash(userId.toString(), suppliedCode).getBytes(StandardCharsets.US_ASCII),
                request.getCodeHash().getBytes(StandardCharsets.US_ASCII))) {
            request.countFailedAttempt();
            requests.save(request);
            return request.getFailedAttempts() >= MAX_FAILED_ATTEMPTS
                    ? VerificationResult.LIMIT_REACHED
                    : VerificationResult.INVALID;
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }

        user.changeEmail(normalizedEmail);
        userRepository.save(user);
        requests.delete(request);
        return VerificationResult.VERIFIED;
    }

    private void enforceResendLimits(Optional<EmailChangeRequest> previous, Instant now) {
        if (previous.isEmpty()) {
            return;
        }
        EmailChangeRequest existing = previous.get();
        Instant nextAllowed = existing.getLastSentAt().plus(RESEND_COOLDOWN);
        if (nextAllowed.isAfter(now)) {
            throw new VerificationException(
                    "OTP_RESEND_WAIT", Duration.between(now, nextAllowed).toSeconds() + 1);
        }
        Instant windowEnds = existing.getSendWindowStartedAt().plus(SEND_WINDOW);
        if (existing.getSendsInWindow() >= MAX_SENDS_PER_WINDOW && windowEnds.isAfter(now)) {
            throw new VerificationException(
                    "OTP_RESEND_LIMIT", Duration.between(now, windowEnds).toSeconds() + 1);
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String newCode() {
        return "%06d".formatted(secureRandom.nextInt(1_000_000));
    }

    private String hash(String userId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of()
                    .formatHex(mac.doFinal((userId + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not hash verification code.", exception);
        }
    }

    public enum VerificationResult { VERIFIED, INVALID, EXPIRED, LIMIT_REACHED }

    public record Delivery(String email, Instant resendAvailableAt, Instant expiresAt) {}

    public record EmailChangeEmailRequested(String recipient, String code, boolean polish) {}
}
