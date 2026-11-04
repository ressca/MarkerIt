package pl.markerit.api.auth;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import pl.markerit.api.users.User;

@Service
public class JwtTokenService {

    public static final String ISSUER = "markerit-api";

    private final JwtEncoder encoder;

    public JwtTokenService(JwtEncoder encoder) {
        this.encoder = encoder;
    }

    public String create(User user, UserSession session, Instant issuedAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .issuedAt(issuedAt)
                .expiresAt(session.getExpiresAt())
                .id(session.getId().toString())
                .claim("email", user.getEmail())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
