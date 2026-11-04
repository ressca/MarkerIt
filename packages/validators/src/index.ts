import { z } from 'zod';

export const registerAccountSchema = z
  .object({
    email: z.string().trim().min(1, 'emailRequired').email('emailInvalid').max(320, 'emailTooLong'),
    password: z
      .string()
      .min(12, 'passwordTooShort')
      .max(72, 'passwordTooLong')
      .refine((value) => new TextEncoder().encode(value).length <= 72, 'passwordTooLong'),
    confirmPassword: z.string().min(1, 'passwordConfirmationRequired'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsDoNotMatch',
  });

export type RegisterAccountInput = z.infer<typeof registerAccountSchema>;

export const loginAccountSchema = z.object({
  email: z.string().trim().min(1, 'emailRequired').email('emailInvalid').max(320, 'emailTooLong'),
  password: z.string().min(1, 'passwordRequired'),
});

export type LoginAccountInput = z.infer<typeof loginAccountSchema>;

export const workspaceNameSchema = z.string().trim().min(1, 'Podaj nazwę workspace’u.');

export const projectNameSchema = z
  .string()
  .trim()
  .min(3, 'Nazwa projektu musi mieć co najmniej 3 znaki.')
  .max(50, 'Nazwa projektu może mieć maksymalnie 50 znaków.');

export const commentBodySchema = z.string().trim().min(1, 'Treść komentarza nie może być pusta.');

export const pinCreateSchema = z.object({
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  body: commentBodySchema,
});

export const commentCreateSchema = z.object({
  body: commentBodySchema,
  parentCommentId: z.uuid().optional(),
});

export const projectPermissionSchema = z.enum(['VIEW', 'COMMENT']);
export const reviewStatusSchema = z.enum(['OPEN', 'CLOSED']);
export const pinStatusSchema = z.enum(['OPEN', 'RESOLVED']);

export type PinCreateInput = z.infer<typeof pinCreateSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type ProjectPermission = z.infer<typeof projectPermissionSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type PinStatus = z.infer<typeof pinStatusSchema>;
