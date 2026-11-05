import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@markerit/api-client';
import { AuthShell } from './auth-shell';
import { EmailVerificationCard, pendingVerificationStorageKey } from './email-verification-card';

const { resendVerification, verifyEmail } = vi.hoisted(() => ({
  resendVerification: vi.fn(),
  verifyEmail: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, resendVerification, verifyEmail };
});

function renderCard(onVerified = vi.fn()) {
  return {
    onVerified,
    ...render(<AuthShell><EmailVerificationCard email="person@example.com" onVerified={onVerified} /></AuthShell>),
  };
}

describe('EmailVerificationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('verifies the entered code, clears pending state and continues', async () => {
    const user = userEvent.setup();
    const onVerified = vi.fn();
    window.sessionStorage.setItem(pendingVerificationStorageKey, 'person@example.com');
    verifyEmail.mockResolvedValue({ id: 'id', email: 'person@example.com', expiresAt: 'later' });
    renderCard(onVerified);

    await user.type(screen.getByLabelText('Kod weryfikacyjny'), '012345');
    await user.click(screen.getByRole('button', { name: 'Potwierdź e-mail i kontynuuj' }));

    expect(verifyEmail).toHaveBeenCalledWith('person@example.com', '012345');
    expect(onVerified).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(pendingVerificationStorageKey)).toBeNull();
  });

  it('shows a localized error for an incorrect code', async () => {
    const user = userEvent.setup();
    verifyEmail.mockRejectedValue(new ApiError(400, 'OTP_INVALID', 'invalid'));
    renderCard();

    await user.type(screen.getByLabelText('Kod weryfikacyjny'), '000000');
    await user.click(screen.getByRole('button', { name: 'Potwierdź e-mail i kontynuuj' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kod jest nieprawidłowy. Sprawdź wiadomość i spróbuj ponownie.');
  });

  it('requests another code and starts the resend cooldown', async () => {
    const user = userEvent.setup();
    resendVerification.mockResolvedValue({
      email: 'person@example.com',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    });
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Wyślij nowy kod' }));

    expect(resendVerification).toHaveBeenCalledWith('person@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent('Wysłaliśmy nowy kod weryfikacyjny.');
    expect(screen.getByRole('button', { name: /Ponowna wysyłka za/ })).toBeDisabled();
  });
});
