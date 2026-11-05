'use client';

import { registerAccount } from '@markerit/api-client';
import { registerAccountSchema, type RegisterAccountInput } from '@markerit/validators';
import { ApiError } from '@markerit/api-client';
import { Button } from '@markerit/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markerit/ui/components/card';
import { Input } from '@markerit/ui/components/input';
import { Label } from '@markerit/ui/components/label';
import { Popover, PopoverContent, PopoverTrigger } from '@markerit/ui/components/popover';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuthCopy } from '../components/auth-shell';

type FormField = keyof RegisterAccountInput;
type FieldErrors = Partial<Record<FormField, string>>;

export function RegisterForm() {
  const copy = useAuthCopy();
  const [values, setValues] = useState<RegisterAccountInput>({ email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [strengthOpen, setStrengthOpen] = useState(false);

  const passwordChecks = {
    minimumLength: values.password.length >= 12,
    longLength: values.password.length >= 16,
    lowercase: /[a-z]/.test(values.password),
    uppercase: /[A-Z]/.test(values.password),
    number: /\d/.test(values.password),
    symbol: /[^a-zA-Z0-9]/.test(values.password),
  };
  const characterTypes = [passwordChecks.lowercase, passwordChecks.uppercase, passwordChecks.number, passwordChecks.symbol]
    .filter(Boolean).length;
  const strength = values.password.length < 12
    ? 0
    : Math.min(4, 1 + Number(values.password.length >= 16) + Number(characterTypes >= 3) + Number(characterTypes === 4));
  const strengthLabel = [copy.passwordStrengthWeak, copy.passwordStrengthWeak, copy.passwordStrengthFair, copy.passwordStrengthGood, copy.passwordStrengthStrong][strength];

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
      await registerAccount({ email: result.data.email, password: result.data.password });
      setComplete(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_REGISTERED') {
        setFieldErrors((current) => ({ ...current, email: 'emailExists' }));
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

  if (complete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{copy.registerTitle}</CardTitle>
          <CardDescription role="status">{copy.registerSuccess}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} className="w-full" render={<Link href="/login" />}>{copy.signInLink}</Button>
        </CardContent>
      </Card>
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
          <Popover open={strengthOpen && Boolean(values.password)} onOpenChange={setStrengthOpen}>
            <div className="space-y-2" onFocus={() => setStrengthOpen(true)} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStrengthOpen(false);
            }}>
              <div className="flex items-center justify-between">
                <Label htmlFor="register-password">{copy.password}</Label>
                <PopoverTrigger
                  aria-label={copy.passwordStrengthHelp}
                  render={<Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" />}
                >
                  <span aria-hidden="true" className="text-xs font-semibold">?</span>
                </PopoverTrigger>
              </div>
              <Input className="h-11" id="register-password" type="password" autoComplete="new-password" required value={values.password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'register-password-error' : 'register-password-hint'} onChange={(event) => updateField('password', event.target.value)} />
              <p id="register-password-hint" className="text-xs text-muted-foreground">{copy.passwordHint}</p>
              {fieldErrors.password && <p id="register-password-error" role="alert" className="text-sm text-destructive">{errorText(fieldErrors.password)}</p>}
              <PopoverContent align="end" className="space-y-3" aria-label={copy.passwordStrengthTitle}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{copy.passwordStrengthTitle}</p>
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    {values.password ? strengthLabel : copy.passwordStrengthEmpty}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={copy.passwordStrengthTitle}
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={strength}
                  className="flex gap-1"
                >
                  {[1, 2, 3, 4].map((step) => (
                    <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= strength ? (strength <= 1 ? 'bg-destructive' : strength === 2 ? 'bg-amber-500' : strength === 3 ? 'bg-lime-500' : 'bg-emerald-500') : 'bg-muted'}`} />
                  ))}
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className={passwordChecks.minimumLength ? 'text-foreground' : ''}>{passwordChecks.minimumLength ? '✓ ' : '• '}{copy.passwordStrengthLength}</li>
                  <li className={passwordChecks.longLength ? 'text-foreground' : ''}>{passwordChecks.longLength ? '✓ ' : '• '}{copy.passwordStrengthLong}</li>
                  <li className={characterTypes >= 3 ? 'text-foreground' : ''}>{characterTypes >= 3 ? '✓ ' : '• '}{copy.passwordStrengthVariety}</li>
                </ul>
              </PopoverContent>
            </div>
          </Popover>
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
