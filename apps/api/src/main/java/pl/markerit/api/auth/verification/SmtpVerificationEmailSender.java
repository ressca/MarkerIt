package pl.markerit.api.auth.verification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "smtp", matchIfMissing = true)
public class SmtpVerificationEmailSender implements VerificationEmailSender {
    private final JavaMailSender mailSender;
    private final String from;

    public SmtpVerificationEmailSender(JavaMailSender mailSender,
            @Value("${app.email.from:noreply@markerit.local}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void sendVerification(String recipient, String code, boolean polish) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, "markerIt");
            helper.setTo(recipient);
            helper.setSubject(VerificationEmailTemplate.subject(polish));
            helper.setText(VerificationEmailTemplate.text(code, polish), VerificationEmailTemplate.html(code, polish));
            mailSender.send(message);
        } catch (Exception exception) {
            throw new IllegalStateException("Verification email could not be sent.", exception);
        }
    }
}
