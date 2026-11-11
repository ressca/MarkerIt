package pl.markerit.api.common;

public class ForbiddenAccessException extends RuntimeException {

    private final String code;

    public ForbiddenAccessException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
