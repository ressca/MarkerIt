package pl.markerit.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;
import pl.markerit.api.auth.session.AuthSessionService;
import pl.markerit.api.auth.session.JwtTokenService;

@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {

    public static final String SESSION_COOKIE = "markerit_session";

    @Bean
    SecretKey jwtSecretKey(@Value("${app.security.jwt-secret}") String secret) {
        byte[] key = secret.getBytes(StandardCharsets.UTF_8);
        if (key.length < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 UTF-8 bytes.");
        }
        return new SecretKeySpec(key, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSecretKey).algorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtSecretKey, AuthSessionService sessions) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        OAuth2TokenValidator<Jwt> issuerAndTime = JwtValidators.createDefaultWithIssuer(JwtTokenService.ISSUER);
        OAuth2TokenValidator<Jwt> activeSession = jwt -> {
            try {
                UUID sessionId = UUID.fromString(jwt.getId());
                if (sessions.isActive(sessionId, Instant.now())) {
                    return OAuth2TokenValidatorResult.success();
                }
            } catch (IllegalArgumentException | NullPointerException ignored) {
                // Missing or malformed session identifiers are rejected below.
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Session is not active.", null));
        };
        decoder.setJwtValidator(jwt -> {
            OAuth2TokenValidatorResult standardResult = issuerAndTime.validate(jwt);
            return standardResult.hasErrors() ? standardResult : activeSession.validate(jwt);
        });
        return decoder;
    }

    /**
     * The resource server only resolves explicit Authorization headers. Session
     * cookies are forwarded to it by {@link SessionCookieBearerTokenFilter}
     * after the CSRF filter has run, so cookie-authenticated unsafe requests
     * cannot bypass CSRF through Spring Security's bearer-token exemption.
     */
    @Bean
    BearerTokenResolver bearerTokenResolver() {
        return new DefaultBearerTokenResolver();
    }

    /**
     * Converts the session cookie into an Authorization header for the resource
     * server. It runs after {@link CsrfFilter}, so a cookie-authenticated unsafe
     * request still requires an XSRF token. Explicit bearer clients are
     * unaffected because their header is already present before this filter.
     */
    static final class SessionCookieBearerTokenFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(
                HttpServletRequest request,
                HttpServletResponse response,
                FilterChain filterChain) throws ServletException, IOException {
            if (request.getHeader(HttpHeaders.AUTHORIZATION) != null) {
                filterChain.doFilter(request, response);
                return;
            }
            String sessionToken = sessionCookie(request);
            if (sessionToken == null || sessionToken.isBlank()) {
                filterChain.doFilter(request, response);
                return;
            }
            filterChain.doFilter(
                    new AuthorizationHeaderRequest(request, "Bearer " + sessionToken),
                    response);
        }

        private static String sessionCookie(HttpServletRequest request) {
            Cookie[] cookies = request.getCookies();
            if (cookies == null) return null;
            for (Cookie cookie : cookies) {
                if (SESSION_COOKIE.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
            return null;
        }
    }

    private static final class AuthorizationHeaderRequest extends HttpServletRequestWrapper {

        private final String authorization;

        private AuthorizationHeaderRequest(HttpServletRequest request, String authorization) {
            super(request);
            this.authorization = authorization;
        }

        @Override
        public String getHeader(String name) {
            if (HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name)) {
                return authorization;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(authorization));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            Set<String> names = new LinkedHashSet<>();
            Enumeration<String> original = super.getHeaderNames();
            if (original != null) {
                while (original.hasMoreElements()) {
                    names.add(original.nextElement());
                }
            }
            names.add(HttpHeaders.AUTHORIZATION);
            return Collections.enumeration(names);
        }
    }

    /**
     * CSRF is required for every unsafe method unless the caller presented an
     * explicit Authorization header. Spring Security 7 automatically ignores
     * bearer requests, so the resource server must not treat the session cookie
     * as a bearer token when that exemption is evaluated.
     */
    static boolean requiresCsrfProtection(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method)
                || "HEAD".equalsIgnoreCase(method)
                || "TRACE".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method)) {
            return false;
        }
        return request.getHeader(HttpHeaders.AUTHORIZATION) == null;
    }

    @Bean
    CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookiePath("/");
        repository.setCookieCustomizer(cookie -> cookie.sameSite("Strict"));
        return repository;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.security.cors-origins}") String allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            CookieCsrfTokenRepository csrfTokenRepository,
            BearerTokenResolver bearerTokenResolver) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                        .requireCsrfProtectionMatcher(SecurityConfiguration::requiresCsrfProtection))
                .addFilterAfter(new SessionCookieBearerTokenFilter(), CsrfFilter.class)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/health", "/api/v1/auth/csrf", "/api/v1/auth/register", "/api/v1/auth/login",
                                "/api/v1/auth/verification/resend", "/api/v1/auth/verification/verify").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .bearerTokenResolver(bearerTokenResolver)
                        .jwt(Customizer.withDefaults())
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                            response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"UNAUTHORIZED\",\"status\":401,\"detail\":\"Sign in to continue.\",\"code\":\"UNAUTHORIZED\"}");
                        }));
        return http.build();
    }
}
