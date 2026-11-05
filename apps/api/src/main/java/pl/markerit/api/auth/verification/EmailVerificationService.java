package pl.markerit.api.auth.verification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.users.UserService;

@Service
public class EmailVerificationService {
    private static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofMinutes(1);
    private static final Duration SEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_SENDS_PER_WINDOW = 5;
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private final UserService users;
    private final UserRepository userRepository;
    private final EmailVerificationCodeRepository codes;
    private final ApplicationEventPublisher events;
    private final byte[] pepper;
    private final SecureRandom secureRandom = new SecureRandom();

    public EmailVerificationService(UserService users, UserRepository userRepository,
            EmailVerificationCodeRepository codes, ApplicationEventPublisher events,
            @Value("${app.security.email-otp-pepper}") String pepper) {
        if (pepper.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("EMAIL_OTP_PEPPER must contain at least 32 UTF-8 bytes.");
        }
        this.users = users;
        this.userRepository = userRepository;
        this.codes = codes;
        this.events = events;
        this.pepper = pepper.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public Delivery requestCode(String email, boolean polish) {
        Optional<User> candidate = users.findByEmail(email);
        if (candidate.isEmpty() || candidate.get().isEmailVerified()) {
            // Keep the public response the same for unknown and already verified addresses.
            return new Delivery(Instant.now().plus(RESEND_COOLDOWN), Instant.now().plus(CODE_LIFETIME));
        }
        User user = candidate.get();
        Instant now = Instant.now();
        Optional<EmailVerificationCode> previous = codes.findById(user.getId());
        if (previous.isPresent()) {
            EmailVerificationCode existing = previous.get();
            Instant nextAllowed = existing.getLastSentAt().plus(RESEND_COOLDOWN);
            if (nextAllowed.isAfter(now)) {
                throw new VerificationException("OTP_RESEND_WAIT", Duration.between(now, nextAllowed).toSeconds() + 1);
            }
            Instant windowEnds = existing.getSendWindowStartedAt().plus(SEND_WINDOW);
            if (existing.getSendsInWindow() >= MAX_SENDS_PER_WINDOW && windowEnds.isAfter(now)) {
                throw new VerificationException("OTP_RESEND_LIMIT", Duration.between(now, windowEnds).toSeconds() + 1);
            }
        }
        String code = newCode();
        String hash = hash(user.getId().toString(), code);
        EmailVerificationCode verification = previous.orElseGet(() ->
                new EmailVerificationCode(user.getId(), hash, now, now.plus(CODE_LIFETIME)));
        if (previous.isPresent()) verification.resend(hash, now, now.plus(CODE_LIFETIME));
        codes.save(verification);
        events.publishEvent(new VerificationEmailRequested(user.getEmail(), code, polish));
        return new Delivery(now.plus(RESEND_COOLDOWN), now.plus(CODE_LIFETIME));
    }

    @Transactional
    public VerificationResult verify(String email, String suppliedCode) {
        Optional<User> candidate = users.findByEmail(email);
        if (candidate.isEmpty() || candidate.get().isEmailVerified()) return VerificationResult.INVALID;
        User user = candidate.get();
        Optional<EmailVerificationCode> stored = codes.findById(user.getId());
        if (stored.isEmpty()) return VerificationResult.INVALID;
        EmailVerificationCode record = stored.get();
        Instant now = Instant.now();
        if (!record.getExpiresAt().isAfter(now)) {
            codes.delete(record);
            return VerificationResult.EXPIRED;
        }
        if (record.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) return VerificationResult.LIMIT_REACHED;
        if (!MessageDigest.isEqual(hash(user.getId().toString(), suppliedCode).getBytes(StandardCharsets.US_ASCII),
                record.getCodeHash().getBytes(StandardCharsets.US_ASCII))) {
            record.countFailedAttempt();
            return record.getFailedAttempts() >= MAX_FAILED_ATTEMPTS
                    ? VerificationResult.LIMIT_REACHED : VerificationResult.INVALID;
        }
        user.verifyEmail();
        userRepository.save(user);
        codes.delete(record);
        return VerificationResult.VERIFIED;
    }

    private String newCode() {
        return "%06d".formatted(secureRandom.nextInt(1_000_000));
    }

    private String hash(String userId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((userId + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not hash verification code.", exception);
        }
    }

    public enum VerificationResult { VERIFIED, INVALID, EXPIRED, LIMIT_REACHED }
    public record Delivery(Instant resendAvailableAt, Instant expiresAt) {}
    public record VerificationEmailRequested(String recipient, String code, boolean polish) {}
}
