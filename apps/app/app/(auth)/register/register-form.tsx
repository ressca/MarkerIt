'use client';

import { registerAccount } from '@markerit/api-client';
import { registerAccountSchema, type RegisterAccountInput } from '@markerit/validators';
import { ApiError } from '@markerit/api-client';
import { Button } from '@markerit/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markerit/ui/components/card';
import { Input } from '@markerit/ui/components/input';
import { Label } from '@markerit/ui/components/label';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthCopy } from '../components/auth-shell';
import { EmailVerificationCard, pendingVerificationStorageKey } from '../components/email-verification-card';

type FormField = keyof RegisterAccountInput;
type FieldErrors = Partial<Record<FormField, string>>;

export function RegisterForm() {
  const copy = useAuthCopy();
  const router = useRouter();
  const [values, setValues] = useState<RegisterAccountInput>({ email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem(pendingVerificationStorageKey);
    if (pendingEmail) setVerificationEmail(pendingEmail);
  }, []);


  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registerAccountSchema.safeParse(values);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FormField | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const challenge = await registerAccount({ email: result.data.email, password: result.data.password });
      window.sessionStorage.setItem(pendingVerificationStorageKey, challenge.email);
      setVerificationEmail(challenge.email);
      setResendAvailableAt(challenge.resendAvailableAt);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_REGISTERED') {
        setFieldErrors((current) => ({ ...current, email: 'emailExists' }));
      } else if (error instanceof ApiError && ['OTP_RESEND_WAIT', 'OTP_RESEND_LIMIT'].includes(error.code)) {
        window.sessionStorage.setItem(pendingVerificationStorageKey, result.data.email);
        setVerificationEmail(result.data.email);
        if (error.retryAfterSeconds) setResendAvailableAt(new Date(Date.now() + error.retryAfterSeconds * 1000).toISOString());
        setFormError(error.code === 'OTP_RESEND_LIMIT' ? 'otpResendLimit' : 'otpResendWait');
      } else if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
        setFormError('networkError');
      } else if (error instanceof ApiError && error.code === 'HTTP_ERROR') {
        setFormError('csrfError');
      } else {
        setFormError('requestError');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function errorText(code: string | undefined) {
    if (!code) return undefined;
    return copy[code as keyof typeof copy] ?? copy.requestError;
  }

  if (verificationEmail) {
    return (
      <EmailVerificationCard
        email={verificationEmail}
        resendAvailableAt={resendAvailableAt}
        onChangeEmail={() => {
          window.sessionStorage.removeItem(pendingVerificationStorageKey);
          setVerificationEmail('');
          setResendAvailableAt(undefined);
        }}
        onVerified={() => { router.replace('/'); router.refresh(); }}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{copy.registerEyebrow}</p>
        <CardTitle className="text-2xl sm:text-3xl">{copy.registerTitle}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{copy.registerDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="register-email">{copy.email}</Label>
            <Input className="h-11" id="register-email" type="email" autoComplete="email" inputMode="email" required value={values.email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'register-email-error' : undefined} onChange={(event) => updateField('email', event.target.value)} />
            {fieldErrors.email && <p id="register-email-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.email)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">{copy.password}</Label>
            <Input className="h-11" id="register-password" type="password" autoComplete="new-password" required value={values.password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'register-password-error' : 'register-password-hint'} onChange={(event) => updateField('password', event.target.value)} />
            <p id="register-password-hint" className="text-xs text-muted-foreground">{copy.passwordHint}</p>
            {fieldErrors.password && <p id="register-password-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.password)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-confirm-password">{copy.confirmPassword}</Label>
            <Input className="h-11" id="register-confirm-password" type="password" autoComplete="new-password" required value={values.confirmPassword} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined} onChange={(event) => updateField('confirmPassword', event.target.value)} />
            {fieldErrors.confirmPassword && <p id="register-confirm-password-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.confirmPassword)}</p>}
          </div>
          {formError && <p role="alert" className="text-sm text-destructive">{errorText(formError)}</p>}
          <Button type="submit" className="h-11 w-full" size="lg" disabled={submitting}>
            {submitting ? copy.registerSubmitting : copy.registerAction}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">{copy.hasAccount} <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">{copy.signInLink}</Link></p>
      </CardContent>
    </Card>
  );
}
