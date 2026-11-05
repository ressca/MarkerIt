package pl.markerit.api.auth.verification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class VerificationEmailDispatchListener {
    private static final Logger logger = LoggerFactory.getLogger(VerificationEmailDispatchListener.class);
    private final VerificationEmailSender sender;

    public VerificationEmailDispatchListener(VerificationEmailSender sender) {
        this.sender = sender;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void send(EmailVerificationService.VerificationEmailRequested event) {
        try {
            sender.sendVerification(event.recipient(), event.code(), event.polish());
        } catch (RuntimeException exception) {
            logger.warn("Verification email dispatch failed; user can request a new code.");
        }
    }
}
