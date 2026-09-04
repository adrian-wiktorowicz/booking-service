import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { checkDatabaseHealth, closeDatabase } from './db/connection.js';
import { IAuthService } from './modules/auth/auth.types.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export interface AppOptions {
  checkDb?: () => Promise<boolean>;
  logger?: boolean;
  autoCloseDb?: boolean;
  authService?: IAuthService;
}

export const buildApp = async (options: AppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: options.logger ?? true,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        },
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code || 'ERROR',
          message: error.message,
        },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  await app.register(helmet);
  await app.register(authRoutes, { prefix: '/api/auth', authService: options.authService });

  app.get('/health/live', async (request, reply) => {
    return { status: 'ok' };
  });

  app.get('/health/ready', async (request, reply) => {
    const checkDb = options.checkDb ?? checkDatabaseHealth;
    const isDbHealthy = await checkDb();

    if (!isDbHealthy) {
      reply.status(503);
      return { status: 'unhealthy', checks: { database: false } };
    }

    return { status: 'ready', checks: { database: true } };
  });

  if (options.autoCloseDb !== false) {
    app.addHook('onClose', async () => {
      await closeDatabase();
    });
  }

  return app;
};