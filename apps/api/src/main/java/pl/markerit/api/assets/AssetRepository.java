package pl.markerit.api.assets;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetRepository extends JpaRepository<Asset, UUID> {

    List<Asset> findByProjectIdAndPurposeAndDeletedAtIsNullOrderByCreatedAtDescIdDesc(
            UUID projectId, String purpose);

    long countByProjectIdAndPurposeAndDeletedAtIsNull(UUID projectId, String purpose);

    Optional<Asset> findByIdAndDeletedAtIsNull(UUID id);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM review_version_assets WHERE asset_id = :assetId)", nativeQuery = true)
    boolean isReferencedByReviewVersion(@Param("assetId") UUID assetId);
}
