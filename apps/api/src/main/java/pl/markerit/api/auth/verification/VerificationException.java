package pl.markerit.api.auth.verification;

public class VerificationException extends RuntimeException {
    private final String code;
    private final long retryAfterSeconds;

    public VerificationException(String code, long retryAfterSeconds) {
        super(code);
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public String getCode() { return code; }
    public long getRetryAfterSeconds() { return retryAfterSeconds; }
}
