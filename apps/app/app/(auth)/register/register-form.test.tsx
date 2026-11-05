import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './register-form';
import { AuthShell } from '../components/auth-shell';

const { registerAccount } = vi.hoisted(() => ({ registerAccount: vi.fn() }));
vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, registerAccount };
});

function renderForm() {
  return render(<AuthShell><RegisterForm /></AuthShell>);
}

describe('RegisterForm', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('validates required values and matching passwords', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Utwórz konto' }));
    expect(await screen.findByText('Podaj adres e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Hasło musi mieć co najmniej 12 znaków.')).toBeInTheDocument();
    expect(screen.getByText('Powtórz hasło.')).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it('creates the account and displays the success state', async () => {
    const user = userEvent.setup();
    registerAccount.mockResolvedValue({ id: 'id', email: 'user@example.com', createdAt: 'now' });
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), ' User@Example.com ');
    await user.type(screen.getByLabelText('Hasło'), 'long-password-123');
    await user.type(screen.getByLabelText('Powtórz hasło'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: 'Utwórz konto' }));
    await waitFor(() => expect(registerAccount).toHaveBeenCalledWith({ email: 'User@Example.com', password: 'long-password-123' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Konto jest gotowe. Możesz się teraz zalogować.');
    expect(screen.getByRole('button', { name: 'Zaloguj się' })).toHaveAttribute('href', '/login');
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
