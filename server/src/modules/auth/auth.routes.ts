import { FastifyPluginAsync } from 'fastify';
import { IAuthService, RegisterInput, EmailExistsError } from './auth.types.js';
import { AuthService } from './auth.service.js';

export interface AuthRouteOptions {
  authService?: IAuthService;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (fastify, opts) => {
  const authService = opts.authService ?? new AuthService();

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
        throw err;
      }
    }
  );
};
