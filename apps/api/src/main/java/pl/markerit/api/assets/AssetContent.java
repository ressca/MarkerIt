package pl.markerit.api.assets;

import java.util.UUID;

public record AssetContent(
        UUID id,
        byte[] data,
        String contentType,
        String originalName,
        String checksumSha256) {
}
