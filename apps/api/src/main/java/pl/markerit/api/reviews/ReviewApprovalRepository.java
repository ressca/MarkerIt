package pl.markerit.api.reviews;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewApprovalRepository extends JpaRepository<ReviewApproval, UUID> {

    @Query("""
            select approval
            from ReviewApproval approval
            where approval.reviewId = :reviewId
              and approval.reviewVersionId = :reviewVersionId
            order by approval.createdAt desc, approval.id desc
            """)
    List<ReviewApproval> findNewestFirst(
            @Param("reviewId") UUID reviewId,
            @Param("reviewVersionId") UUID reviewVersionId);
}
