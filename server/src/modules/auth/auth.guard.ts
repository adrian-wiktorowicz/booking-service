import { FastifyRequest } from 'fastify';
import { IAuthService, UnauthorizedError, AuthenticatedUser } from './auth.types.js';
import { verifyJwt } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

export function createAuthGuard(authService: IAuthService, jwtSecret: string) {
  return async function authenticate(request: FastifyRequest) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      throw new UnauthorizedError();
    }

    let payload;
    try {
      payload = verifyJwt(token, jwtSecret);
    } catch {
      throw new UnauthorizedError();
    }

    const user = await authService.getUserById(payload.userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    request.user = {
      userId: user.id,
      email: user.email,
    };
  };
}
