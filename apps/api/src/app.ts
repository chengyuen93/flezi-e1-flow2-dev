import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import type { SqliteDatabase } from './database';
import { createAuthController } from './controllers/authController';
import { preparePasswordVerification } from './passwords';

function errorDetails(error: unknown): { status?: number; type?: string } {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  const status = 'status' in error ? error.status : undefined;
  const type = 'type' in error ? error.type : undefined;

  return {
    status: typeof status === 'number' ? status : undefined,
    type: typeof type === 'string' ? type : undefined,
  };
}

export async function createApp(database: SqliteDatabase): Promise<Koa> {
  await preparePasswordVerification();

  const app = new Koa();
  const router = new Router();
  const authController = createAuthController(database);

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const details = errorDetails(error);

      if (details.status === 413 || details.type === 'entity.too.large') {
        ctx.status = 400;
        ctx.body = {
          message: 'Validation failed',
          fieldErrors: { body: 'Request body is too large' },
        };
        return;
      }

      if (details.status === 400 && details.type === 'entity.parse.failed') {
        ctx.status = 400;
        ctx.body = {
          message: 'Validation failed',
          fieldErrors: { body: 'Request body must be valid JSON' },
        };
        return;
      }

      throw error;
    }
  });

  app.use(bodyParser({
    enableTypes: ['json'],
    jsonLimit: '16kb',
  }));

  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.get('/me', authController.me);
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
