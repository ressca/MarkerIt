package pl.markerit.api.auth.verification;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "resend")
public class ResendVerificationEmailSender implements VerificationEmailSender {
    private final RestClient client;
    private final String apiKey;
    private final String from;

    public ResendVerificationEmailSender(
            @Value("${app.email.resend-api-key:}") String apiKey,
            @Value("${app.email.from}") String from,
            @Value("${app.email.resend-api-url:https://api.resend.com/emails}") String apiUrl) {
        this.apiKey = apiKey;
        this.from = from;
        this.client = RestClient.builder().baseUrl(apiUrl).build();
    }

    @Override
    public void sendVerification(String recipient, String code, boolean polish) {
        send(recipient,
                VerificationEmailTemplate.subject(polish),
                VerificationEmailTemplate.html(code, polish),
                VerificationEmailTemplate.text(code, polish));
    }

    @Override
    public void sendEmailChange(String recipient, String code, boolean polish) {
        send(recipient,
                VerificationEmailTemplate.emailChangeSubject(polish),
                VerificationEmailTemplate.emailChangeHtml(code, polish),
                VerificationEmailTemplate.emailChangeText(code, polish));
    }

    private void send(String recipient, String subject, String html, String text) {
        if (apiKey.isBlank()) throw new IllegalStateException("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
        client.post().contentType(MediaType.APPLICATION_JSON).header("Authorization", "Bearer " + apiKey)
                .body(Map.of(
                        "from", "markerIt <" + from + ">",
                        "to", new String[] {recipient},
                        "subject", subject,
                        "html", html,
                        "text", text))
                .retrieve().toBodilessEntity();
    }
}
