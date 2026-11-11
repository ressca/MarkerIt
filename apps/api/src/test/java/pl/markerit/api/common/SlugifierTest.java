package pl.markerit.api.common;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class SlugifierTest {

    @Test void normalizesPolishCharactersAndSpaces() {
        assertEquals("moja-przestrzen", Slugifier.slugify("Moja Przestrzeń", "workspace", 80));
        assertEquals("zazolc-gesla-jazn", Slugifier.slugify("Zażółć gęślą jaźń", "workspace", 80));
    }

    @Test void fallsBackAndTrimsToLimit() {
        assertEquals("workspace", Slugifier.slugify("!!!", "workspace", 80));
        assertEquals("abcdefghij", Slugifier.slugify("abcdefghijk", "workspace", 10));
    }

    @Test void addsSuffixWhenSlugExists() {
        String unique = Slugifier.unique("Studio", "workspace", 80, candidate -> candidate.equals("studio"));
        assertTrue(unique.startsWith("studio-"));
        assertTrue(unique.length() > "studio".length());
    }

    @Test void returnsBaseWhenFree() {
        assertEquals("studio", Slugifier.unique("Studio", "workspace", 80, candidate -> false));
    }
}
