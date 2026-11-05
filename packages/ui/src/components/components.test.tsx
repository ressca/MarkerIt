import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from './avatar';
import { Badge } from './badge';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';
import { Button as LegacyButton } from '../button';
import { StatusBadge } from '../status-badge';
import { ThemeToggle } from './theme-toggle';

describe('shared UI primitives', () => {
  it('renders every card section and preserves custom attributes', () => {
    render(<Card data-testid="card"><CardHeader><CardTitle>Title</CardTitle><CardDescription>Details</CardDescription><CardAction>Action</CardAction></CardHeader><CardContent>Content</CardContent><CardFooter>Footer</CardFooter></Card>);
    expect(screen.getByTestId('card')).toHaveAttribute('data-slot', 'card');
    for (const text of ['Title', 'Details', 'Action', 'Content', 'Footer']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders badges in all variants and supports a custom render element', () => {
    const { container } = render(<><Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="destructive">Danger</Badge><Badge variant="outline">Outline</Badge><Badge variant="ghost">Ghost</Badge><Badge variant="link">Link style</Badge><Badge render={<a href="/x" />}>Anchor</Badge></>);
    expect(screen.getByText('Default')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByRole('link', { name: 'Anchor' })).toHaveAttribute('href', '/x');
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(7);
  });

  it('renders avatar, fallback, image, badge and group companions', () => {
    render(<Avatar size="sm"><AvatarImage src="/avatar.png" alt="Person" /><AvatarFallback>AB</AvatarFallback><AvatarBadge data-testid="avatar-badge" /><AvatarGroup><Avatar size="lg"><AvatarFallback>CD</AvatarFallback></Avatar><AvatarGroupCount>+2</AvatarGroupCount></AvatarGroup></Avatar>);
    expect(screen.getByTestId('avatar-badge')).toHaveAttribute('data-slot', 'avatar-badge');
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('CD')).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveAttribute('data-slot', 'avatar-group-count');
  });

  it('forwards input and label props', () => {
    render(<><Label htmlFor="name">Name</Label><Input id="name" placeholder="Name" data-testid="name" /></>);
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Name');
    expect(screen.getByTestId('name')).toHaveAttribute('data-slot', 'input');
  });

  it('renders the legacy button and status badge with defaults and custom variants', () => {
    render(<><LegacyButton>Primary</LegacyButton><LegacyButton variant="secondary" className="extra">Secondary</LegacyButton><LegacyButton variant="quiet">Quiet</LegacyButton><StatusBadge status="open">Open</StatusBadge><StatusBadge status="resolved" className="extra">Resolved</StatusBadge><StatusBadge status="closed">Closed</StatusBadge></>);
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('mi-button--primary');
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('mi-button--secondary', 'extra');
    expect(screen.getByRole('button', { name: 'Quiet' })).toHaveClass('mi-button--quiet');
    expect(screen.getByText('Open')).toHaveAttribute('data-status', 'open');
    expect(screen.getByText('Resolved')).toHaveClass('mi-status-badge--resolved', 'extra');
    expect(screen.getByText('Closed')).toHaveAttribute('data-status', 'closed');
  });

  it('toggles, persists and restores the selected theme', async () => {
    window.localStorage.clear();
    const { rerender } = render(<ThemeToggle switchToDarkLabel="Dark" switchToLightLabel="Light" />);
    const darkButton = await screen.findByRole('button', { name: 'Dark' });
    darkButton.click();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem('markerit-theme')).toBe('dark');
    rerender(<ThemeToggle switchToDarkLabel="Dark" switchToLightLabel="Light" />);
    screen.getByRole('button', { name: 'Light' }).click();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem('markerit-theme')).toBe('light');
  });
});
