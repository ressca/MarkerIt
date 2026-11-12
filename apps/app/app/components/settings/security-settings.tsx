'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@markerit/ui';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react';
import {
  changeMyPassword,
  requestEmailChange,
  resendEmailChange,
  verifyEmailChange,
} from '@markerit/api-client';
import type {
  EmailChangeChallengeDto,
  UserProfileDto,
} from '@markerit/api-client';
import { useAppLocale } from '../../lib/use-app-locale';
import { settingsErrorMessage } from './settings-errors';

interface SecuritySettingsProps {
  profile: UserProfileDto;
  onProfileUpdated: (profile: UserProfileDto) => void;
}

export function SecuritySettings({ profile, onProfileUpdated }: SecuritySettingsProps) {
  const { messages } = useAppLocale();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [challenge, setChallenge] = useState<EmailChangeChallengeDto | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword) {
      setPasswordError(messages.settings.passwordError);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(messages.settings.passwordTooShort);
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError(messages.settings.passwordTooLong);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(messages.settings.passwordsDoNotMatch);
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice(
        `${messages.settings.passwordChanged} ${messages.settings.passwordChangedSessions}`,
      );
    } catch (cause) {
      setPasswordError(settingsErrorMessage(cause, messages));
    } finally {
      setPasswordBusy(false);
    }
  }

  function handleEmailRequested(nextChallenge: EmailChangeChallengeDto) {
    setChallenge(nextChallenge);
    setEmailDialogOpen(false);
    setCodeDialogOpen(true);
    setEmailNotice(null);
  }

  function handleEmailVerified(updated: UserProfileDto) {
    onProfileUpdated(updated);
    setCodeDialogOpen(false);
    setChallenge(null);
    setEmailNotice(messages.settings.emailChanged);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {messages.settings.securityTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.settings.securityDescription}
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {messages.settings.passwordTitle}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.settings.passwordDescription}
            </p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submitPassword} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="settings-current-password">
              {messages.settings.currentPassword}
            </Label>
            <Input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setPasswordError(null);
              }}
              className="h-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-new-password">{messages.settings.newPassword}</Label>
              <Input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordError(null);
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-confirm-password">
                {messages.settings.confirmPassword}
              </Label>
              <Input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordError(null);
                }}
                className="h-9"
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          {passwordNotice && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              {passwordNotice}
            </p>
          )}

          <Button type="submit" size="sm" disabled={passwordBusy}>
            {passwordBusy ? messages.settings.changingPassword : messages.settings.changePassword}
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-border/80 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {messages.settings.emailTitle}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.settings.emailDescription}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground">{profile.email}</p>
          </div>
        </div>

        {emailNotice && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {emailNotice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            className="gap-1.5"
          >
            <Mail className="size-3.5" />
            {messages.settings.changeEmail}
          </Button>
          {challenge && !codeDialogOpen && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCodeDialogOpen(true)}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              {messages.settings.verifyEmailCode}
            </Button>
          )}
        </div>
      </section>

      <EmailChangeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        currentEmail={profile.email}
        onRequested={handleEmailRequested}
      />

      {challenge && (
        <EmailCodeDialog
          open={codeDialogOpen}
          onOpenChange={setCodeDialogOpen}
          challenge={challenge}
          onChallengeUpdated={setChallenge}
          onVerified={handleEmailVerified}
        />
      )}
    </div>
  );
}

function EmailChangeDialog({
  open,
  onOpenChange,
  currentEmail,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onRequested: (challenge: EmailChangeChallengeDto) => void;
}) {
  const { messages } = useAppLocale();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewEmail('');
      setCurrentPassword('');
      setError(null);
    }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(messages.settings.emailInvalid);
      return;
    }
    if (normalized === currentEmail.toLowerCase()) {
      setError(messages.settings.emailUnchanged);
      return;
    }
    if (!currentPassword) {
      setError(messages.settings.currentPasswordInvalid);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const challenge = await requestEmailChange({
        newEmail: normalized,
        currentPassword,
      });
      onRequested(challenge);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={messages.settings.cancel}>
        <DialogHeader>
          <DialogTitle>{messages.settings.emailChangeTitle}</DialogTitle>
          <DialogDescription>{messages.settings.emailChangeDescription}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="settings-new-email">{messages.settings.newEmailLabel}</Label>
            <Input
              id="settings-new-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                setError(null);
              }}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              {messages.settings.emailChangePasswordHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email-password">
              {messages.settings.currentPassword}
            </Label>
            <Input
              id="settings-email-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setError(null);
              }}
              className="h-9"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {messages.settings.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? messages.settings.sendingCode : messages.settings.sendCode}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailCodeDialog({
  open,
  onOpenChange,
  challenge,
  onChallengeUpdated,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: EmailChangeChallengeDto;
  onChallengeUpdated: (challenge: EmailChangeChallengeDto) => void;
  onVerified: (profile: UserProfileDto) => void;
}) {
  const { messages } = useAppLocale();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [availableAt, setAvailableAt] = useState(Date.parse(challenge.resendAvailableAt));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setAvailableAt(Date.parse(challenge.resendAvailableAt));
  }, [challenge.resendAvailableAt]);

  const secondsLeft = Math.max(0, Math.ceil((availableAt - now) / 1000));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(messages.settings.emailCodeInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const profile = await verifyEmailChange({ newEmail: challenge.email, code });
      onVerified(profile);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await resendEmailChange();
      onChallengeUpdated(updated);
      setCode('');
      setNotice(messages.settings.codeResent);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setResending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={messages.settings.cancel} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            {messages.settings.emailCodeTitle}
          </DialogTitle>
          <DialogDescription>
            {messages.settings.emailCodeDescription}{' '}
            <span className="font-medium text-foreground">{challenge.email}</span>
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email-code">{messages.settings.codeLabel}</Label>
            <Input
              id="settings-email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              className="h-12 text-center text-xl font-semibold tracking-[0.45em]"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={resending || secondsLeft > 0}
              onClick={() => void resend()}
            >
              {secondsLeft > 0
                ? `${messages.settings.resendIn} ${secondsLeft}s`
                : messages.settings.resendCode}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? messages.settings.verifyingCode : messages.settings.verifyEmailCode}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
