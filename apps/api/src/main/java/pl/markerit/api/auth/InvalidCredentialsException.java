package pl.markerit.api.auth;



public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("The email or password is invalid.");
    }
}
