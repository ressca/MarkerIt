package pl.markerit.api.auth.verification;

public interface VerificationEmailSender {
    void sendVerification(String recipient, String code, boolean polish);
}
