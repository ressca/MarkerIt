import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@markerit/api-client';
import { LoginForm } from './login-form';
import { AuthShell } from '../components/auth-shell';

const { loginAccount, replace, refresh } = vi.hoisted(() => ({
  loginAccount: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, loginAccount };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));

function renderForm() {
  return render(<AuthShell><LoginForm /></AuthShell>);
}

describe('LoginForm', () => {
  beforeEach(() => { vi.clearAllMocks(); window.sessionStorage.clear(); window.localStorage.clear(); });

  it('shows validation errors and does not call the API for invalid input', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));
    expect(await screen.findByText('Podaj adres e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Podaj hasło.')).toBeInTheDocument();
    expect(loginAccount).not.toHaveBeenCalled();
  });

  it('submits valid credentials and navigates to the app', async () => {
    const user = userEvent.setup();
    loginAccount.mockResolvedValue({ id: 'id', email: 'user@example.com' });
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), 'user@example.com');
    await user.type(screen.getByLabelText('Hasło'), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));
    await waitFor(() => expect(loginAccount).toHaveBeenCalledWith({ email: 'user@example.com', password: 'a-strong-password' }));
    expect(replace).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the localized invalid credentials response', async () => {
    const user = userEvent.setup();
    loginAccount.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'bad'));
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), 'user@example.com');
    await user.type(screen.getByLabelText('Hasło'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));
    expect(await screen.findByText('E-mail lub hasło są nieprawidłowe.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('reopens email verification when a returning user has not verified yet', async () => {
    const user = userEvent.setup();
    loginAccount.mockRejectedValue(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'verify first'));
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), 'pending@example.com');
    await user.type(screen.getByLabelText('Hasło'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

    await waitFor(() => expect(loginAccount).toHaveBeenCalledWith({ email: 'pending@example.com', password: 'long-password-123' }));
    expect(window.sessionStorage.getItem('markerit.pending-email-verification')).toBe('pending@example.com');
    expect(await screen.findByText('Potwierdź swój e-mail')).toBeInTheDocument();
    expect(screen.getByText(/pending@example.com/)).toBeInTheDocument();
  });

  it('clears server errors when the user edits a field', async () => {
    const user = userEvent.setup();
    loginAccount.mockRejectedValue(new Error('unexpected'));
    renderForm();
    await user.type(screen.getByLabelText('Adres e-mail'), 'user@example.com');
    await user.type(screen.getByLabelText('Hasło'), 'valid-password');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));
    expect(await screen.findByText('Coś poszło nie tak. Spróbuj ponownie.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Hasło'), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
