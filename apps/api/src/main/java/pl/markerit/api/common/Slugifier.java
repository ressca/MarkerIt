package pl.markerit.api.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Predicate;

public final class Slugifier {

    private Slugifier() {
    }

    public static String slugify(String value, String fallback, int maxLength) {
        String source = value == null ? "" : value.replace('ł', 'l').replace('Ł', 'L');
        String normalized = Normalizer.normalize(source, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        if (normalized.isBlank()) normalized = fallback;
        if (normalized.length() > maxLength) normalized = normalized.substring(0, maxLength).replaceAll("-+$", "");
        return normalized;
    }

    public static String unique(String value, String fallback, int maxLength, Predicate<String> exists) {
        String base = slugify(value, fallback, maxLength - 7);
        if (!exists.test(base)) return base;

        for (int attempt = 0; attempt < 10; attempt++) {
            String candidate = base + "-" + UUID.randomUUID().toString().substring(0, 6);
            if (!exists.test(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not generate a unique slug.");
    }
}
