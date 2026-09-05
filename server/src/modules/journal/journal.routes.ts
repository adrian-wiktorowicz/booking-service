import { FastifyPluginAsync } from 'fastify';
import { IJournalService, JournalFilterOptions, UpsertJournalEntryInput } from './journal.types.js';
import { JournalService } from './journal.service.js';
import { DrizzleJournalRepository } from './journal.repository.js';
import { IAuthService } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { createAuthGuard } from '../auth/auth.guard.js';

export interface JournalRouteOptions {
  journalService?: IJournalService;
  authService?: IAuthService;
  jwtSecret?: string;
}

export const journalRoutes: FastifyPluginAsync<JournalRouteOptions> = async (fastify, opts) => {
  const journalService = opts.journalService ?? new JournalService(new DrizzleJournalRepository());
  const authService = opts.authService ?? new AuthService();
  const jwtSecret =
    opts.jwtSecret ??
    (authService instanceof AuthService ? authService.jwtSecret : process.env.JWT_SECRET) ??
    'default-jwt-secret-for-development-must-be-32-chars';
  const authenticate = createAuthGuard(authService, jwtSecret);

  fastify.get<{ Querystring: JournalFilterOptions }>(
    '/entries',
    {
      preHandler: [authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await journalService.getEntries(request.user.userId, request.query);
      return reply.send(result);
    }
  );

  fastify.get<{ Params: { date: string } }>(
    '/entries/:date',
    {
      preHandler: [authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['date'],
          properties: {
            date: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await journalService.getEntryByDate(
        request.user.userId,
        request.params.date
      );
      return reply.send(result);
    }
  );

  fastify.put<{ Params: { date: string }; Body: UpsertJournalEntryInput }>(
    '/entries/:date',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await journalService.saveEntry(
        request.user.userId,
        request.params.date,
        request.body ?? ({} as any)
      );
      return reply.send(result);
    }
  );
};
