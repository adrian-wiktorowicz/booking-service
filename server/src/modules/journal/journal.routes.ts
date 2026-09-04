import { FastifyPluginAsync } from 'fastify';
import {
  IJournalService,
  UpsertJournalEntryInput,
  InvalidDateError,
  InvalidMoodError,
  PayloadValidationError,
} from './journal.types.js';
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

  fastify.put<{ Params: { date: string }; Body: UpsertJournalEntryInput }>(
    '/entries/:date',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { date } = request.params;
        const result = await journalService.saveEntry(
          request.user.userId,
          date,
          request.body ?? ({} as any)
        );
        return reply.status(200).send(result);
      } catch (err) {
        if (
          err instanceof InvalidDateError ||
          err instanceof InvalidMoodError ||
          err instanceof PayloadValidationError
        ) {
          return reply.status(err.statusCode).send({
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
