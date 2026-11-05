import { describe, expect, it } from 'vitest';
import RootLayout from './layout';
import AuthLayout from './(auth)/layout';
import LoginPage, { metadata as loginMetadata } from './(auth)/login/page';
import RegisterPage, { metadata as registerMetadata } from './(auth)/register/page';

describe('application route shells', () => {
  it('wraps application content in Polish document metadata', () => {
    const view = RootLayout({ children: <p>App body</p> });
    expect(view.props.lang).toBe('pl');
    expect(view.props.children.props.children).toHaveProperty('props.children', 'App body');
  });

  it('wraps auth pages in the auth shell', () => {
    const view = AuthLayout({ children: <p>Auth body</p> });
    expect(view.props.children.props.children).toBe('Auth body');
  });

  it('provides login and registration route content and metadata', () => {
    expect(LoginPage().type.name).toBe('LoginForm');
    expect(RegisterPage().type.name).toBe('RegisterForm');
    expect(loginMetadata.title).toBe('Sign in | markerIt');
    expect(registerMetadata.description).toContain('markerIt account');
  });
});
