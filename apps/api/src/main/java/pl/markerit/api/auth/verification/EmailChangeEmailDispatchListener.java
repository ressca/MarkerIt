package pl.markerit.api.auth.verification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class EmailChangeEmailDispatchListener {
    private static final Logger logger = LoggerFactory.getLogger(EmailChangeEmailDispatchListener.class);
    private final VerificationEmailSender sender;

    public EmailChangeEmailDispatchListener(VerificationEmailSender sender) {
        this.sender = sender;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void send(EmailChangeService.EmailChangeEmailRequested event) {
        try {
            sender.sendEmailChange(event.recipient(), event.code(), event.polish());
        } catch (RuntimeException exception) {
            logger.warn("Email change message dispatch failed; user can request a new code.");
        }
    }
}
