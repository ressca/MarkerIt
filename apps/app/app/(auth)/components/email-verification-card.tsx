'use client';

import { ApiError, resendVerification, verifyEmail } from '@markerit/api-client';
import { Button } from '@markerit/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markerit/ui/components/card';
import { Input } from '@markerit/ui/components/input';
import { Label } from '@markerit/ui/components/label';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuthCopy } from './auth-shell';

export const pendingVerificationStorageKey = 'markerit.pending-email-verification';

type Props = {
  email: string;
  resendAvailableAt?: string;
  returning?: boolean;
  onChangeEmail?: () => void;
  onVerified: () => void;
};

export function EmailVerificationCard({ email, resendAvailableAt, returning = false, onChangeEmail, onVerified }: Props) {
  const copy = useAuthCopy();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [availableAt, setAvailableAt] = useState(resendAvailableAt ? Date.parse(resendAvailableAt) : 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((availableAt - now) / 1000));

  function authText(key: string) {
    return copy[key as keyof typeof copy] ?? copy.requestError;
  }

  function handleApiError(cause: unknown) {
    if (cause instanceof ApiError) {
      const messages: Record<string, string> = {
        OTP_INVALID: 'otpInvalid',
        OTP_EXPIRED: 'otpExpired',
        OTP_VERIFY_LIMIT: 'otpVerifyLimit',
        OTP_RESEND_WAIT: 'otpResendWait',
        OTP_RESEND_LIMIT: 'otpResendLimit',
        NETWORK_ERROR: 'networkError',
      };
      if (cause.retryAfterSeconds) setAvailableAt(Date.now() + cause.retryAfterSeconds * 1000);
      return authText(messages[cause.code] ?? 'requestError');
    }
    return copy.requestError;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(copy.otpCodeLength);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await verifyEmail(email, code);
      window.sessionStorage.removeItem(pendingVerificationStorageKey);
      onVerified();
    } catch (cause) {
      setError(handleApiError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await resendVerification(email);
      setAvailableAt(Date.parse(result.resendAvailableAt));
      setCode('');
      setNotice(copy.otpResent);
    } catch (cause) {
      setError(handleApiError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/15 shadow-lg shadow-primary/5">
      <CardHeader className="gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{copy.otpEyebrow}</p>
        <CardTitle className="text-2xl sm:text-3xl">{copy.otpTitle}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {returning ? copy.otpWelcomeBack : copy.otpDescription} <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="email-verification-code">{copy.otpCodeLabel}</Label>
            <Input
              className="h-12 text-center text-xl font-semibold tracking-[0.45em]"
              id="email-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              aria-invalid={Boolean(error)}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
          <Button type="submit" className="h-11 w-full" size="lg" disabled={busy}>
            {busy ? copy.otpVerifying : copy.otpVerifyAction}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <p className="mb-2 text-xs text-muted-foreground">{copy.otpNoEmail}</p>
          <Button type="button" variant="link" disabled={busy || secondsLeft > 0} onClick={resend}>
            {secondsLeft > 0 ? `${copy.otpResendIn} ${secondsLeft}s` : copy.otpResendAction}
          </Button>
          {onChangeEmail && <Button type="button" variant="link" disabled={busy} onClick={onChangeEmail}>{copy.otpChangeEmail}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
