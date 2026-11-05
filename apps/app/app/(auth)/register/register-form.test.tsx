import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './register-form';
import { AuthShell } from '../components/auth-shell';

const { registerAccount } = vi.hoisted(() => ({ registerAccount: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, registerAccount };
});

function renderForm() {
  return render(<AuthShell><RegisterForm /></AuthShell>);
}

describe('RegisterForm', () => {
  beforeEach(() => { vi.clearAllMocks(); window.sessionStorage.clear(); });

  it('validates required values and matching passwords', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Utwórz konto' }));
    expect(await screen.findByText('Podaj adres e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Hasło musi mieć co najmniej 8 znaków.')).toBeInTheDocument();
    expect(screen.getByText('Powtórz hasło.')).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it('shows the 8-character password requirement beside the password field', () => {
    renderForm();
    expect(screen.getByText('Użyj co najmniej 8 znaków.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pokaż siłę hasła' })).not.toBeInTheDocument();
  });

  it('creates the account and opens the email verification card', async () => {
    const user = userEvent.setup();
    registerAccount.mockResolvedValue({ email: 'user@example.com', expiresAt: 'later', resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), ' User@Example.com ');
    await user.type(screen.getByLabelText('Hasło'), 'long-password-123');
    await user.type(screen.getByLabelText('Powtórz hasło'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: 'Utwórz konto' }));
    await waitFor(() => expect(registerAccount).toHaveBeenCalledWith({ email: 'User@Example.com', password: 'long-password-123' }));
    expect(await screen.findByText('Potwierdź swój e-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Kod weryfikacyjny')).toBeInTheDocument();
  });

  it('shows an existing-email error on the email field', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@markerit/api-client');
    registerAccount.mockRejectedValue(new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'duplicate'));
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), 'user@example.com');
    await user.type(screen.getByLabelText('Hasło'), 'long-password-123');
    await user.type(screen.getByLabelText('Powtórz hasło'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: 'Utwórz konto' }));
    expect(await screen.findByText('Konto z tym adresem e-mail już istnieje.')).toBeInTheDocument();
  });
});
