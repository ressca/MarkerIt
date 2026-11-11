import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('combines class names and resolves conflicting Tailwind utilities', () => {
    const hidden = false;
    expect(cn('px-2 text-sm', hidden && 'hidden', 'px-4')).toBe('text-sm px-4');
  });
});
