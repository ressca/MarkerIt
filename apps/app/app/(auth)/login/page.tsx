import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in | markerIt',
  description: 'Sign in to continue reviewing your markerIt projects.',
};

export default function LoginPage() {
  return <LoginForm />;
}
