import { ApiError } from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';

/**
 * Maps a backend error code to a localized project message.
 *
 * The API returns Polish problem details, so the UI must translate known codes
 * itself and only fall back to localized generic copy for unknown failures.
 */
export function apiErrorMessage(
  cause: unknown,
  messages: TranslationMessages,
  fallback: string,
): string {
  if (!(cause instanceof ApiError)) {
    return fallback;
  }

  switch (cause.code) {
    case 'PROJECT_CLOSED':
      return messages.project.projectClosedError;
    case 'ASSET_LIMIT_REACHED':
      return messages.project.assetLimitError;
    case 'ASSET_TOO_LARGE':
      return messages.project.photoTooLarge;
    case 'UNSUPPORTED_CONTENT_TYPE':
    case 'CONTENT_TYPE_MISMATCH':
    case 'INVALID_IMAGE':
      return messages.project.photoUnsupported;
    case 'EMPTY_FILE':
      return messages.project.photoRequired;
    case 'ASSET_IN_USE':
      return messages.project.assetInUseError;
    case 'ASSET_NOT_FOUND':
    case 'ASSET_CONTENT_NOT_FOUND':
      return messages.project.assetNotFoundError;
    case 'REVIEW_FORBIDDEN':
      return messages.project.reviewForbiddenError;
    case 'REVIEW_VERSION_STALE':
      return messages.project.staleVersionError;
    case 'REVIEW_CLOSED':
      return messages.project.reviewClosedError;
    case 'REVIEW_NOT_APPROVED':
      return messages.project.reviewNotApprovedError;
    case 'REVIEW_VERSION_MISSING':
      return messages.project.reviewVersionMissingError;
    case 'PROJECT_NOT_FOUND':
    case 'REVIEW_NOT_FOUND':
      return messages.project.notFoundError;
    case 'PIN_NOT_FOUND':
      return messages.project.pinNotFoundError;
    case 'COMMENT_NOT_FOUND':
    case 'INVALID_PARENT_COMMENT':
      return messages.project.commentNotFoundError;
    case 'INVALID_COORDINATES':
      return messages.project.invalidCoordinatesError;
    case 'COMMENT_BODY_REQUIRED':
      return messages.project.commentRequired;
    case 'COMMENT_FORBIDDEN':
      return messages.project.commentForbiddenError;
    case 'COMMENT_DEPTH_EXCEEDED':
      return messages.project.commentDepthError;
    case 'TOO_MANY_ATTACHMENTS':
      return messages.project.attachmentLimitError;
    case 'ATTACHMENT_NOT_FOUND':
      return messages.project.attachmentNotFoundError;
    case 'NETWORK_ERROR':
      return messages.project.networkError;
    default:
      return fallback;
  }
}
