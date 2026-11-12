package pl.markerit.api.reviews;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewReviewerRepository
        extends JpaRepository<ReviewReviewer, ReviewReviewer.ReviewReviewerId> {

    @Query("""
            select reviewer
            from ReviewReviewer reviewer
            where reviewer.id.reviewId = :reviewId
            order by reviewer.createdAt asc, reviewer.id.userId asc
            """)
    List<ReviewReviewer> findForReview(@Param("reviewId") UUID reviewId);
}
