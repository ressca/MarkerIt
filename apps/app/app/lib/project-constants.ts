export const MAX_PROJECT_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_REVIEWERS = 20;
/** The API accepts at most 10 attachments per comment. */
export const MAX_COMMENT_ATTACHMENTS = 10;
/** Attachment files share the same size/type limits as review images. */
export const MAX_ATTACHMENT_BYTES = MAX_PHOTO_BYTES;
