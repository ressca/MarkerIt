package pl.markerit.api.storage;

/**
 * Signals that a database asset points at an object that is no longer present
 * in the backing store.
 */
public class StorageObjectNotFoundException extends RuntimeException {

    public StorageObjectNotFoundException(String key) {
        super("Storage object not found: " + key);
    }
}
