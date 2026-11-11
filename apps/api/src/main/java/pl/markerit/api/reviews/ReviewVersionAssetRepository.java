package pl.markerit.api.reviews;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewVersionAssetRepository
        extends JpaRepository<ReviewVersionAsset, ReviewVersionAsset.ReviewVersionAssetId> {

    @Query("""
            select reviewAsset
            from ReviewVersionAsset reviewAsset
            where reviewAsset.id.reviewVersionId = :reviewVersionId
            order by reviewAsset.position asc
            """)
    List<ReviewVersionAsset> findForVersion(@Param("reviewVersionId") UUID reviewVersionId);

    @Query("""
            select reviewAsset
            from ReviewVersionAsset reviewAsset
            where reviewAsset.id.reviewVersionId in :reviewVersionIds
            order by reviewAsset.id.reviewVersionId asc, reviewAsset.position asc
            """)
    List<ReviewVersionAsset> findForVersions(@Param("reviewVersionIds") Collection<UUID> reviewVersionIds);

    @Query("select count(reviewAsset) from ReviewVersionAsset reviewAsset where reviewAsset.id.assetId = :assetId")
    long countByAssetId(@Param("assetId") UUID assetId);
}
