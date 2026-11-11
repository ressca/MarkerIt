import { cookies } from 'next/headers';
import type { UserProfile } from '../components/types';

const SESSION_COOKIE = 'markerit_session';

interface SessionTokenPayload {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
}

function decodePayload(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    return typeof payload === 'object' && payload !== null ? (payload as SessionTokenPayload) : null;
  } catch {
    return null;
  }
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  if (!localPart) return 'Użytkownik';

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/**
 * Reads the authenticated user from the session cookie.
 *
 * The cookie is validated (signature + active database session) by the request
 * proxy before this page renders. Here we only need the claims for display.
 */
export async function getSessionUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decodePayload(token);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  const id =
    typeof payload?.sub === 'string'
      ? payload.sub
      : typeof payload?.id === 'string'
        ? payload.id
        : '';

  if (!email) return null;

  const displayName =
    typeof payload?.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : displayNameFromEmail(email);
  return {
    id,
    email,
    displayName,
    initials: initialsFromName(displayName),
  };
}
