package pl.markerit.api.storage;

import java.io.InputStream;

public interface StorageService {

    String provider();

    void putObject(String key, InputStream content, long size, String contentType);

    byte[] getObject(String key);

    void deleteObject(String key);

    String publicUrl(String key);
}
