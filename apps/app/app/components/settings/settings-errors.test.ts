import { describe, expect, it } from 'vitest';
import { ApiError } from '@markerit/api-client';
import { getMessages } from '@markerit/i18n';
import { settingsErrorMessage } from './settings-errors';

const messages = getMessages('pl');

function apiError(code: string) {
  return new ApiError(400, code, 'error');
}

describe('settingsErrorMessage', () => {
  it('maps account and verification errors to localized copy', () => {
    expect(settingsErrorMessage(apiError('CURRENT_PASSWORD_INVALID'), messages)).toBe(
      messages.settings.currentPasswordInvalid,
    );
    expect(settingsErrorMessage(apiError('EMAIL_UNCHANGED'), messages)).toBe(
      messages.settings.emailUnchanged,
    );
    expect(settingsErrorMessage(apiError('EMAIL_ALREADY_REGISTERED'), messages)).toBe(
      messages.settings.emailAlreadyUsed,
    );
    expect(settingsErrorMessage(apiError('EMAIL_CHANGE_NOT_REQUESTED'), messages)).toBe(
      messages.settings.emailChangeNotRequested,
    );
    expect(settingsErrorMessage(apiError('OTP_INVALID'), messages)).toBe(
      messages.settings.emailCodeInvalid,
    );
    expect(settingsErrorMessage(apiError('OTP_EXPIRED'), messages)).toBe(
      messages.settings.emailCodeExpired,
    );
    expect(settingsErrorMessage(apiError('LOGIN_RATE_LIMITED'), messages)).toBe(
      messages.settings.tooManyAttempts,
    );
  });

  it('maps avatar, network and unknown failures', () => {
    expect(settingsErrorMessage(apiError('AVATAR_TOO_LARGE'), messages)).toBe(
      messages.settings.avatarTooLarge,
    );
    expect(settingsErrorMessage(apiError('UNSUPPORTED_CONTENT_TYPE'), messages)).toBe(
      messages.settings.avatarUnsupported,
    );
    expect(settingsErrorMessage(apiError('NETWORK_ERROR'), messages)).toBe(
      messages.settings.networkError,
    );
    expect(settingsErrorMessage(apiError('SOMETHING_ELSE'), messages)).toBe(
      messages.settings.genericError,
    );
    expect(settingsErrorMessage(new Error('boom'), messages)).toBe(
      messages.settings.genericError,
    );
  });
});
