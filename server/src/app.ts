import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { checkDatabaseHealth, closeDatabase } from './db/connection.js';
import { AuthenticatedUser, IAuthService } from './modules/auth/auth.types.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { IJournalService } from './modules/journal/journal.types.js';
import { journalRoutes } from './modules/journal/journal.routes.js';

export interface AppOptions {
  checkDb?: () => Promise<boolean>;
  logger?: boolean;
  autoCloseDb?: boolean;
  authService?: IAuthService;
  journalService?: IJournalService;
  jwtSecret?: string;
}

export const buildApp = async (options: AppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: process.env.TRUST_PROXY !== 'false',
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

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please retry later.',
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

  app.decorateRequest('user', null as unknown as AuthenticatedUser);

  await app.register(helmet);
  await app.register(rateLimit, {
    global: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
  await app.register(authRoutes, {
    prefix: '/api/auth',
    authService: options.authService,
    jwtSecret: options.jwtSecret,
  });
  await app.register(journalRoutes, {
    prefix: '/api/journal',
    journalService: options.journalService,
    authService: options.authService,
    jwtSecret: options.jwtSecret,
  });

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