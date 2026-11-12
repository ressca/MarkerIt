import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailChangeChallengeDto, UserProfileDto } from '@markerit/api-client';
import { Sidebar } from '../sidebar';
import type { UserProfile } from '../types';
import { SettingsDialog } from './settings-dialog';

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  uploadMyAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  changeMyPassword: vi.fn(),
  requestEmailChange: vi.fn(),
  resendEmailChange: vi.fn(),
  verifyEmailChange: vi.fn(),
  logoutAccount: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, ...api };
});

const user: UserProfile = {
  id: 'user-1',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
};

const profile: UserProfileDto = {
  id: 'user-1',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
  locale: 'pl',
  avatarAssetId: null,
  avatarUrl: null,
  createdAt: '2026-11-01T10:00:00Z',
};

const challenge: EmailChangeChallengeDto = {
  email: 'new@example.com',
  resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
};

function renderDialog(onProfileUpdated = vi.fn()) {
  return {
    onProfileUpdated,
    ...render(
      <SettingsDialog
        open
        onOpenChange={vi.fn()}
        onProfileUpdated={onProfileUpdated}
      />,
    ),
  };
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    api.getMyProfile.mockResolvedValue(profile);
  });

  it('loads the profile and saves the display name', async () => {
    const browser = userEvent.setup();
    const updated = { ...profile, displayName: 'Anna Nowak', initials: 'AN' };
    api.updateMyProfile.mockResolvedValue(updated);
    const { onProfileUpdated } = renderDialog();

    const input = await screen.findByLabelText('Nazwa wyświetlana');
    expect(input).toHaveValue('Anna Kowalska');

    await browser.clear(input);
    await browser.type(input, 'Anna Nowak');
    await browser.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));

    await waitFor(() => {
      expect(api.updateMyProfile).toHaveBeenCalledWith({ displayName: 'Anna Nowak' });
    });
    expect(await screen.findByText('Zmiany zostały zapisane.')).toBeInTheDocument();
    expect(onProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Anna Nowak', initials: 'AN' }),
    );
  });

  it('uploads and removes the avatar', async () => {
    const withAvatar = { ...profile, avatarAssetId: 'asset-9' };
    api.uploadMyAvatar.mockResolvedValue(withAvatar);
    api.deleteMyAvatar.mockResolvedValue(profile);
    renderDialog();

    await screen.findByLabelText('Nazwa wyświetlana');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['png'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.uploadMyAvatar).toHaveBeenCalledWith(file));
    expect(await screen.findByText('Zdjęcie profilowe zostało zaktualizowane.')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Usuń zdjęcie' }));
    await waitFor(() => expect(api.deleteMyAvatar).toHaveBeenCalled());
    expect(await screen.findByText('Zdjęcie profilowe zostało usunięte.')).toBeInTheDocument();
  });

  it('changes the interface language and persists it locally', async () => {
    const browser = userEvent.setup();
    api.updateMyProfile.mockResolvedValue({ ...profile, locale: 'en' });
    renderDialog();

    await screen.findByLabelText('Nazwa wyświetlana');
    await browser.click(screen.getByRole('tab', { name: 'Preferencje' }));
    await browser.click(screen.getByRole('radio', { name: 'English' }));

    await waitFor(() => {
      expect(api.updateMyProfile).toHaveBeenCalledWith({ locale: 'en' });
      expect(window.localStorage.getItem('markerit-locale')).toBe('en');
    });
    expect(await screen.findByText('Interface language updated.')).toBeInTheDocument();
  });

  it('validates and changes the password', async () => {
    const browser = userEvent.setup();
    api.changeMyPassword.mockResolvedValue(undefined);
    renderDialog();

    await screen.findByLabelText('Nazwa wyświetlana');
    await browser.click(screen.getByRole('tab', { name: 'Bezpieczeństwo' }));

    await browser.type(screen.getByLabelText('Aktualne hasło'), 'current-password');
    await browser.type(screen.getByLabelText('Nowe hasło'), 'new-password');
    await browser.type(screen.getByLabelText('Potwierdź nowe hasło'), 'new-password');
    await browser.click(screen.getByRole('button', { name: 'Zmień hasło' }));

    await waitFor(() => {
      expect(api.changeMyPassword).toHaveBeenCalledWith({
        currentPassword: 'current-password',
        newPassword: 'new-password',
      });
    });
    expect(await screen.findByText(/Hasło zostało zmienione/)).toBeInTheDocument();
  });

  it('runs the email change flow in two dialogs', async () => {
    const browser = userEvent.setup();
    const updated = { ...profile, email: 'new@example.com' };
    api.requestEmailChange.mockResolvedValue(challenge);
    api.verifyEmailChange.mockResolvedValue(updated);
    const { onProfileUpdated } = renderDialog();

    await screen.findByLabelText('Nazwa wyświetlana');
    await browser.click(screen.getByRole('tab', { name: 'Bezpieczeństwo' }));
    await browser.click(screen.getByRole('button', { name: 'Zmień adres e-mail' }));

    const emailDialog = await screen.findByRole('dialog', { name: 'Zmiana adresu e-mail' });
    await browser.type(within(emailDialog).getByLabelText('Nowy adres e-mail'), 'new@example.com');
    await browser.type(within(emailDialog).getByLabelText('Aktualne hasło'), 'current-password');
    await browser.click(within(emailDialog).getByRole('button', { name: 'Wyślij kod' }));

    await waitFor(() => {
      expect(api.requestEmailChange).toHaveBeenCalledWith({
        newEmail: 'new@example.com',
        currentPassword: 'current-password',
      });
    });

    const codeDialog = await screen.findByRole('dialog', { name: /Potwierdź nowy adres/ });
    await browser.type(within(codeDialog).getByLabelText('Kod weryfikacyjny'), '012345');
    await browser.click(within(codeDialog).getByRole('button', { name: 'Potwierdź adres' }));

    await waitFor(() => {
      expect(api.verifyEmailChange).toHaveBeenCalledWith({
        newEmail: 'new@example.com',
        code: '012345',
      });
    });
    expect(await screen.findByText('Adres e-mail został zmieniony.')).toBeInTheDocument();
    expect(onProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
    );
  });

  it('opens the settings dialog from the avatar menu', async () => {
    const browser = userEvent.setup();
    render(<Sidebar user={user} workspaces={[]} />);

    await browser.click(screen.getByRole('button', { name: 'Menu profilu użytkownika' }));
    await browser.click(await screen.findByRole('menuitem', { name: 'Ustawienia' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(api.getMyProfile).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeInTheDocument();
  });
});
