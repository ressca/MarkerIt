package pl.markerit.api.assets.web;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import pl.markerit.api.assets.AssetContent;
import pl.markerit.api.assets.AssetService;
import pl.markerit.api.common.CurrentUser;

@RestController
@RequestMapping("/api/v1")
public class AssetController {

    private static final String IMMUTABLE_CONTENT_CACHE =
            "private, max-age=31536000, immutable";

    private final AssetService assets;

    public AssetController(AssetService assets) {
        this.assets = assets;
    }

    @PostMapping(path = "/projects/{projectId}/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AssetResponse upload(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestPart("file") MultipartFile file) {
        return assets.upload(CurrentUser.id(jwt), projectId, file);
    }

    @GetMapping("/projects/{projectId}/assets")
    public List<AssetResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        return assets.list(CurrentUser.id(jwt), projectId);
    }

    @GetMapping("/assets/{assetId}/content")
    public ResponseEntity<byte[]> content(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID assetId) {
        AssetContent content = assets.content(CurrentUser.id(jwt), assetId);
        ContentDisposition disposition = ContentDisposition.inline()
                .filename(content.originalName(), StandardCharsets.UTF_8)
                .build();
        String etag = content.checksumSha256() == null || content.checksumSha256().isBlank()
                ? content.id().toString()
                : content.checksumSha256();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .contentLength(content.data().length)
                .header(HttpHeaders.CACHE_CONTROL, IMMUTABLE_CONTENT_CACHE)
                .header(HttpHeaders.ETAG, '"' + etag + '"')
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(content.data());
    }

    @DeleteMapping("/assets/{assetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID assetId) {
        assets.delete(CurrentUser.id(jwt), assetId);
    }
}
