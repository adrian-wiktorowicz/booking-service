import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Health Endpoints & Production Guardrails', () => {
  it('GET /health/live returns 200 ok and security headers', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false });
    const response = await app.inject({
      method: 'GET',
      url: '/health/live'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });

  it('GET /health/ready returns 200 when database is healthy', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      checkDb: async () => true
    });
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      checks: { database: true }
    });
    await app.close();
  });

  it('GET /health/ready returns 503 when database is unreachable', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      checkDb: async () => false
    });
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready'
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'unhealthy',
      checks: { database: false }
    });
    await app.close();
  });
});