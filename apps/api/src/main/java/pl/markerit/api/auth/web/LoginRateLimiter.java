package pl.markerit.api.auth.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Per-process fixed-window limiter for login attempts, keyed by both source IP and account. */
@Component
public class LoginRateLimiter {
    private static final int MAX_TRACKED_KEYS = 10_000;

    private final int maxAttempts;
    private final Duration window;
    private final Map<String, Window> attempts = new LinkedHashMap<>();

    public LoginRateLimiter(
            @Value("${app.security.login-rate-limit.max-attempts:10}") int maxAttempts,
            @Value("${app.security.login-rate-limit.window:PT15M}") Duration window) {
        if (maxAttempts < 1 || window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("Login rate limit must have positive attempts and window.");
        }
        this.maxAttempts = maxAttempts;
        this.window = window;
    }

    public synchronized boolean allow(String remoteAddress, String email, Instant now) {
        removeExpired(now);
        String ipKey = "ip:" + digest(remoteAddress == null ? "unknown" : remoteAddress);
        String accountKey = "account:" + digest(email.trim().toLowerCase(Locale.ROOT));
        Window ip = attempts.get(ipKey);
        Window account = attempts.get(accountKey);
        if (isLimited(ip, now) || isLimited(account, now)) return false;

        record(ipKey, ip, now);
        record(accountKey, account, now);
        return true;
    }

    public synchronized long retryAfterSeconds(String remoteAddress, String email, Instant now) {
        String ipKey = "ip:" + digest(remoteAddress == null ? "unknown" : remoteAddress);
        String accountKey = "account:" + digest(email.trim().toLowerCase(Locale.ROOT));
        return Math.max(1, Math.max(remainingSeconds(attempts.get(ipKey), now),
                remainingSeconds(attempts.get(accountKey), now)));
    }

    private boolean isLimited(Window entry, Instant now) {
        return entry != null && entry.startedAt.plus(window).isAfter(now) && entry.count >= maxAttempts;
    }

    private long remainingSeconds(Window entry, Instant now) {
        if (!isLimited(entry, now)) return 0;
        return Duration.between(now, entry.startedAt.plus(window)).toSeconds();
    }

    private void record(String key, Window entry, Instant now) {
        if (entry == null || !entry.startedAt.plus(window).isAfter(now)) {
            attempts.put(key, new Window(now, 1));
        } else {
            entry.count++;
        }
        trimToCapacity();
    }

    private void removeExpired(Instant now) {
        Iterator<Window> iterator = attempts.values().iterator();
        while (iterator.hasNext()) {
            if (!iterator.next().startedAt.plus(window).isAfter(now)) iterator.remove();
        }
    }

    private void trimToCapacity() {
        while (attempts.size() > MAX_TRACKED_KEYS) {
            attempts.remove(attempts.keySet().iterator().next());
        }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static final class Window {
        private final Instant startedAt;
        private int count;

        private Window(Instant startedAt, int count) {
            this.startedAt = startedAt;
            this.count = count;
        }
    }
}
