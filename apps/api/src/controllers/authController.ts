import type { Context, Middleware } from 'koa';
import { z } from 'zod';
import type { SqliteDatabase } from '../database';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  getAuthenticatedUser,
  loginUser,
  registerUser,
} from '../services/authService';

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, `Email must be ${EMAIL_MAX_LENGTH} characters or fewer`)
  .email('Enter a valid email address');

const registrationSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(1, 'Password is required')
    .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
});

type FieldErrors = Record<string, string>;

function validationResponse(error: z.ZodError) {
  const fieldErrors = error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0]?.toString() ?? 'body';
    errors[field] ??= issue.message;
    return errors;
  }, {});

  return {
    message: 'Validation failed',
    fieldErrors,
  };
}

function invalidInput(ctx: Context, error: z.ZodError): void {
  ctx.status = 400;
  ctx.body = validationResponse(error);
}

function duplicateEmail(ctx: Context): void {
  ctx.status = 409;
  ctx.body = {
    message: 'Email already in use',
    fieldErrors: {
      email: 'Email already in use',
    },
  };
}

function unauthorized(ctx: Context, message: string): void {
  ctx.status = 401;
  ctx.body = { message };
}

export function createAuthController(database: SqliteDatabase): {
  register: Middleware;
  login: Middleware;
  me: Middleware;
} {
  return {
    register: async (ctx) => {
      const result = registrationSchema.safeParse(ctx.request.body);
      if (!result.success) {
        invalidInput(ctx, result.error);
        return;
      }

      try {
        ctx.status = 201;
        ctx.body = await registerUser(database, result.data);
      } catch (error) {
        if (error instanceof EmailAlreadyExistsError) {
          duplicateEmail(ctx);
          return;
        }

        throw error;
      }
    },

    login: async (ctx) => {
      const result = loginSchema.safeParse(ctx.request.body);
      if (!result.success) {
        invalidInput(ctx, result.error);
        return;
      }

      try {
        ctx.status = 200;
        ctx.body = await loginUser(database, result.data);
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          unauthorized(ctx, 'Invalid email or password');
          return;
        }

        throw error;
      }
    },

    me: (ctx) => {
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(ctx.get('authorization'));
      if (!match) {
        unauthorized(ctx, 'Unauthorized');
        return;
      }

      const user = getAuthenticatedUser(database, match[1]);
      if (!user) {
        unauthorized(ctx, 'Unauthorized');
        return;
      }

      ctx.status = 200;
      ctx.body = {
        user: {
          id: user.id,
          email: user.email,
        },
      };
    },
  };
}
