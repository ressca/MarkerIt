'use client';

import { ApiError, loginAccount } from '@markerit/api-client';
import { loginAccountSchema, type LoginAccountInput } from '@markerit/validators';
import { Button } from '@markerit/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markerit/ui/components/card';
import { Input } from '@markerit/ui/components/input';
import { Label } from '@markerit/ui/components/label';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuthCopy } from '../components/auth-shell';
import { EmailVerificationCard, pendingVerificationStorageKey } from '../components/email-verification-card';

type FormField = keyof LoginAccountInput;
type FieldErrors = Partial<Record<FormField, string>>;

export function LoginForm() {
  const copy = useAuthCopy();
  const router = useRouter();
  const [values, setValues] = useState<LoginAccountInput>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem(pendingVerificationStorageKey);
    if (pendingEmail) setVerificationEmail(pendingEmail);
  }, []);

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  function errorText(code: string | undefined) {
    if (!code) return undefined;
    return copy[code as keyof typeof copy] ?? copy.requestError;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginAccountSchema.safeParse(values);
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
      await loginAccount(result.data);
      router.replace('/');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setFormError('invalidCredentials');
      } else if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        window.sessionStorage.setItem(pendingVerificationStorageKey, result.data.email);
        setVerificationEmail(result.data.email);
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

  if (verificationEmail) {
    return (
      <EmailVerificationCard
        email={verificationEmail}
        returning
        onChangeEmail={() => {
          window.sessionStorage.removeItem(pendingVerificationStorageKey);
          setVerificationEmail('');
        }}
        onVerified={() => { router.replace('/'); router.refresh(); }}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{copy.loginEyebrow}</p>
        <CardTitle className="text-2xl sm:text-3xl">{copy.loginTitle}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{copy.loginDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="login-email">{copy.email}</Label>
            <Input id="login-email" type="email" autoComplete="email" inputMode="email" required value={values.email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} onChange={(event) => updateField('email', event.target.value)} />
            {fieldErrors.email && <p id="login-email-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.email)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">{copy.password}</Label>
            <Input id="login-password" type="password" autoComplete="current-password" required value={values.password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} onChange={(event) => updateField('password', event.target.value)} />
            {fieldErrors.password && <p id="login-password-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.password)}</p>}
          </div>
          {formError && <p role="alert" className="text-sm text-destructive">{errorText(formError)}</p>}
          <Button type="submit" className="h-11 w-full" size="lg" disabled={submitting}>
            {submitting ? copy.loginSubmitting : copy.loginAction}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">{copy.noAccount} <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">{copy.createAccountLink}</Link></p>
      </CardContent>
    </Card>
  );
}
