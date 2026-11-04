import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create account | markerIt',
  description: 'Create a markerIt account to collect clear feedback on your projects.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
