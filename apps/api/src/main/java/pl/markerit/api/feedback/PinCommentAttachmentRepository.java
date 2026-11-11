package pl.markerit.api.feedback;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PinCommentAttachmentRepository
        extends JpaRepository<PinCommentAttachment, PinCommentAttachment.PinCommentAttachmentId> {

    List<PinCommentAttachment> findByIdPinCommentIdInOrderByIdPinCommentIdAscPositionAsc(
            Collection<UUID> pinCommentIds);

    /**
     * Counts links from comments that are still visible. Links owned only by
     * soft-deleted comments do not keep an attachment alive.
     */
    @Query("select count(link) from PinCommentAttachment link "
            + "where link.id.assetId = :assetId and link.id.pinCommentId in "
            + "(select comment.id from PinComment comment where comment.deletedAt is null)")
    long countActiveLinksForAsset(@Param("assetId") UUID assetId);

    /**
     * Removes links owned by soft-deleted comments before physically deleting
     * an attachment. Needed because {@code pin_comment_attachments.asset_id}
     * uses {@code ON DELETE RESTRICT}.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from PinCommentAttachment link "
            + "where link.id.assetId = :assetId and link.id.pinCommentId in "
            + "(select comment.id from PinComment comment where comment.deletedAt is not null)")
    int deleteLinksForDeletedComments(@Param("assetId") UUID assetId);
}
