import { describe, expect, it } from 'vitest';
import { ApiError } from '@markerit/api-client';
import { getMessages } from '@markerit/i18n';
import { apiErrorMessage } from './api-errors';

const en = getMessages('en');
const pl = getMessages('pl');
const fallback = 'Fallback message.';

describe('apiErrorMessage', () => {
  it('maps known review and project codes to localized copy', () => {
    expect(apiErrorMessage(new ApiError(409, 'REVIEW_VERSION_STALE', 'stale'), en, fallback)).toBe(
      en.project.staleVersionError,
    );
    expect(apiErrorMessage(new ApiError(409, 'PROJECT_CLOSED', 'closed'), pl, fallback)).toBe(
      pl.project.projectClosedError,
    );
    expect(apiErrorMessage(new ApiError(403, 'REVIEW_FORBIDDEN', 'forbidden'), en, fallback)).toBe(
      en.project.reviewForbiddenError,
    );
    expect(apiErrorMessage(new ApiError(409, 'REVIEW_VERSION_STALE', 'stale'), pl, fallback)).toBe(
      pl.project.staleVersionError,
    );
  });

  it('maps asset errors and not-found responses', () => {
    expect(apiErrorMessage(new ApiError(429, 'ASSET_LIMIT_REACHED', 'limit'), en, fallback)).toBe(
      en.project.assetLimitError,
    );
    expect(apiErrorMessage(new ApiError(409, 'ASSET_IN_USE', 'used'), en, fallback)).toBe(
      en.project.assetInUseError,
    );
    expect(apiErrorMessage(new ApiError(404, 'REVIEW_NOT_FOUND', 'missing'), en, fallback)).toBe(
      en.project.notFoundError,
    );
    expect(apiErrorMessage(new ApiError(0, 'NETWORK_ERROR', 'offline'), en, fallback)).toBe(
      en.project.networkError,
    );
    expect(apiErrorMessage(new ApiError(413, 'ASSET_TOO_LARGE', 'big'), en, fallback)).toBe(
      en.project.photoTooLarge,
    );
    expect(
      apiErrorMessage(new ApiError(400, 'UNSUPPORTED_CONTENT_TYPE', 'type'), en, fallback),
    ).toBe(en.project.photoUnsupported);
    expect(apiErrorMessage(new ApiError(400, 'EMPTY_FILE', 'empty'), en, fallback)).toBe(
      en.project.photoRequired,
    );
  });

  it('falls back for unknown codes and non-API failures', () => {
    expect(apiErrorMessage(new ApiError(500, 'SOMETHING_ELSE', 'boom'), en, fallback)).toBe(fallback);
    expect(apiErrorMessage(new Error('offline'), en, fallback)).toBe(fallback);
    expect(apiErrorMessage('server error', en, fallback)).toBe(fallback);
  });
});
