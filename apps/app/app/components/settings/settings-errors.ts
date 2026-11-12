import { ApiError } from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';

/**
 * Maps API problem codes to localized settings copy. The API returns Polish
 * problem details, so known codes are translated on the client.
 */
export function settingsErrorMessage(
  cause: unknown,
  messages: TranslationMessages,
): string {
  if (!(cause instanceof ApiError)) {
    return messages.settings.genericError;
  }

  switch (cause.code) {
    case 'INVALID_DISPLAY_NAME':
      return messages.settings.displayNameTooShort;
    case 'INVALID_REQUEST': {
      const fields = new Set(cause.fieldErrors.map((error) => error.field));
      if (fields.has('displayName')) return messages.settings.displayNameTooShort;
      if (fields.has('newEmail')) return messages.settings.emailInvalid;
      if (fields.has('currentPassword')) return messages.settings.currentPasswordInvalid;
      if (fields.has('newPassword')) return messages.settings.passwordTooShort;
      return messages.settings.genericError;
    }
    case 'CURRENT_PASSWORD_INVALID':
      return messages.settings.currentPasswordInvalid;
    case 'EMAIL_UNCHANGED':
      return messages.settings.emailUnchanged;
    case 'EMAIL_ALREADY_REGISTERED':
      return messages.settings.emailAlreadyUsed;
    case 'EMAIL_CHANGE_NOT_REQUESTED':
      return messages.settings.emailChangeNotRequested;
    case 'OTP_INVALID':
      return messages.settings.emailCodeInvalid;
    case 'OTP_EXPIRED':
      return messages.settings.emailCodeExpired;
    case 'OTP_VERIFY_LIMIT':
    case 'OTP_RESEND_LIMIT':
    case 'LOGIN_RATE_LIMITED':
      return messages.settings.tooManyAttempts;
    case 'OTP_RESEND_WAIT':
      return messages.settings.emailResendWait;
    case 'AVATAR_TOO_LARGE':
    case 'ASSET_TOO_LARGE':
      return messages.settings.avatarTooLarge;
    case 'UNSUPPORTED_CONTENT_TYPE':
    case 'CONTENT_TYPE_MISMATCH':
    case 'INVALID_IMAGE':
      return messages.settings.avatarUnsupported;
    case 'EMPTY_FILE':
      return messages.settings.avatarError;
    case 'NETWORK_ERROR':
      return messages.settings.networkError;
    default:
      return messages.settings.genericError;
  }
}
