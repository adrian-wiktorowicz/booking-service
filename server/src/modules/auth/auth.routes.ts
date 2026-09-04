import { FastifyPluginAsync } from 'fastify';
import {
  IAuthService,
  RegisterInput,
  LoginInput,
  EmailExistsError,
  PasswordCompromisedError,
  InvalidCredentialsError,
} from './auth.types.js';
import { AuthService } from './auth.service.js';
import { createAuthGuard } from './auth.guard.js';

export interface AuthRouteOptions {
  authService?: IAuthService;
  jwtSecret?: string;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (fastify, opts) => {
  const authService = opts.authService ?? new AuthService();
  const jwtSecret =
    opts.jwtSecret ??
    (authService instanceof AuthService ? authService.jwtSecret : process.env.JWT_SECRET) ??
    'default-jwt-secret-for-development-must-be-32-chars';
  const authenticate = createAuthGuard(authService, jwtSecret);

  fastify.post<{ Body: RegisterInput }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.register(request.body);
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof EmailExistsError) {
          return reply.status(409).send({
            error: {
              code: err.code,
              message: err.message,
            },
          });
        }
        if (err instanceof PasswordCompromisedError) {
          return reply.status(422).send({
            error: {
              code: err.code,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  fastify.post<{ Body: LoginInput }>(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.login(request.body);
        return reply
          .header('Cache-Control', 'no-store, no-cache, must-revalidate')
          .header('Pragma', 'no-cache')
          .status(200)
          .send(result);
      } catch (err) {
        if (err instanceof InvalidCredentialsError) {
          return reply.status(401).send({
            error: {
              code: err.code,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  fastify.get(
    '/me',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      return reply.status(200).send({
        userId: request.user.userId,
        email: request.user.email,
      });
    }
  );

  fastify.delete(
    '/account',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const result = await authService.deleteAccount(request.user.userId);
      return reply.status(200).send(result);
    }
  );
};

