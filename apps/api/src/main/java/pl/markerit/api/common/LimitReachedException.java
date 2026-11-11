package pl.markerit.api.common;

public class LimitReachedException extends RuntimeException {

    private final String code;

    public LimitReachedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
