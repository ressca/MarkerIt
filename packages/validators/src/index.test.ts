import { describe, expect, it } from 'vitest';
import {
  commentBodySchema,
  commentCreateSchema,
  loginAccountSchema,
  pinCreateSchema,
  pinStatusSchema,
  projectNameSchema,
  projectPermissionSchema,
  registerAccountSchema,
  reviewStatusSchema,
  workspaceNameSchema,
} from './index';

describe('account schemas', () => {
  it('trims and accepts valid registration details', () => {
    expect(registerAccountSchema.parse({ email: ' user@example.com ', password: '123456789012', confirmPassword: '123456789012' }).email)
      .toBe('user@example.com');
  });
  it.each([
    ['', '123456789012', '123456789012', 'emailRequired'],
    ['bad-email', '123456789012', '123456789012', 'emailInvalid'],
    ['a'.repeat(321) + '@example.com', '123456789012', '123456789012', 'emailTooLong'],
    ['a@example.com', 'short', 'short', 'passwordTooShort'],
    ['a@example.com', 'x'.repeat(73), 'x'.repeat(73), 'passwordTooLong'],
    ['a@example.com', 'ą'.repeat(37), 'ą'.repeat(37), 'passwordTooLong'],
    ['a@example.com', '123456789012', '', 'passwordConfirmationRequired'],
    ['a@example.com', '123456789012', 'different-pass', 'passwordsDoNotMatch'],
  ])('rejects invalid registration values (%s)', (email, password, confirmPassword, code) => {
    const result = registerAccountSchema.safeParse({ email, password, confirmPassword });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toContain(code);
  });

  it('accepts valid login and validates email and password presence', () => {
    expect(loginAccountSchema.safeParse({ email: 'person@example.com', password: 'x' }).success).toBe(true);
    expect(loginAccountSchema.safeParse({ email: 'nope', password: '' }).success).toBe(false);
  });
});

describe('project and review schemas', () => {
  it('validates names, comments, coordinates, IDs and enums', () => {
    expect(workspaceNameSchema.safeParse(' Team ').success).toBe(true);
    expect(workspaceNameSchema.safeParse('  ').success).toBe(false);
    expect(projectNameSchema.safeParse('xy').success).toBe(false);
    expect(projectNameSchema.safeParse('x'.repeat(51)).success).toBe(false);
    expect(projectNameSchema.safeParse('  website  ').success).toBe(true);
    expect(commentBodySchema.safeParse('  ').success).toBe(false);
    expect(pinCreateSchema.safeParse({ xPercent: 0, yPercent: 100, body: 'Fix this' }).success).toBe(true);
    expect(pinCreateSchema.safeParse({ xPercent: 101, yPercent: -1, body: ' ' }).success).toBe(false);
    expect(commentCreateSchema.safeParse({ body: 'Looks good', parentCommentId: 'not-a-uuid' }).success).toBe(false);
    expect(commentCreateSchema.safeParse({ body: 'Looks good' }).success).toBe(true);
    expect(projectPermissionSchema.safeParse('COMMENT').success).toBe(true);
    expect(projectPermissionSchema.safeParse('ADMIN').success).toBe(false);
    expect(reviewStatusSchema.safeParse('CLOSED').success).toBe(true);
    expect(pinStatusSchema.safeParse('RESOLVED').success).toBe(true);
  });
});
