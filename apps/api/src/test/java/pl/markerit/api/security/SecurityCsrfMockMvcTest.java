package pl.markerit.api.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.session.JwtTokenService;

@WebMvcTest(controllers = SecurityCsrfMockMvcTest.ProbeController.class)
@Import({
        SecurityConfiguration.class,
        SecurityCsrfMockMvcTest.TestBeans.class,
        SecurityCsrfMockMvcTest.ProbeController.class
})
class SecurityCsrfMockMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Test
    void rejectsCookieAuthenticatedPostWithoutCsrfToken() throws Exception {
        mockMvc.perform(post("/probe/mutate")
                        .cookie(sessionCookie()))
                .andExpect(status().isForbidden());
    }

    @Test
    void acceptsCookieAuthenticatedPostWithCsrfToken() throws Exception {
        MvcResult csrf = mockMvc.perform(get("/probe/csrf").cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andReturn();
        String token = com.jayway.jsonpath.JsonPath.read(
                csrf.getResponse().getContentAsString(), "$.token");
        Cookie xsrf = csrf.getResponse().getCookie("XSRF-TOKEN");

        mockMvc.perform(post("/probe/mutate")
                        .cookie(sessionCookie(), xsrf)
                        .header("X-XSRF-TOKEN", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("user-1"));
    }

    @Test
    void allowsSafeCookieAuthenticatedRequestsWithoutCsrfToken() throws Exception {
        mockMvc.perform(get("/probe/whoami").cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("user-1"));
    }

    @Test
    void exemptsExplicitAuthorizationBearerRequestsFromCsrf() throws Exception {
        mockMvc.perform(post("/probe/mutate")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("user-1"));
    }

    private Cookie sessionCookie() {
        return new Cookie(SecurityConfiguration.SESSION_COOKIE, token());
    }

    private String token() {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtTokenService.ISSUER)
                .subject("user-1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .id(UUID.randomUUID().toString())
                .claim("email", "user@example.com")
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableWebSecurity
    static class TestBeans {

        @Bean
        AuthSessionService authSessionService() {
            AuthSessionService sessions = mock(AuthSessionService.class);
            when(sessions.isActive(any(), any())).thenReturn(true);
            return sessions;
        }
    }

    @RestController
    static class ProbeController {

        @GetMapping("/probe/csrf")
        CsrfResponse csrf(CsrfToken token) {
            return new CsrfResponse(token.getToken());
        }

        @GetMapping("/probe/whoami")
        ProbeResponse whoami(@AuthenticationPrincipal Jwt jwt) {
            return new ProbeResponse(jwt.getSubject());
        }

        @PostMapping("/probe/mutate")
        ProbeResponse mutate(@AuthenticationPrincipal Jwt jwt) {
            return new ProbeResponse(jwt.getSubject());
        }
    }

    record CsrfResponse(String token) {
    }

    record ProbeResponse(String subject) {
    }
}
