import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, starting graceful teardown`);
    const timeout = setTimeout(() => {
      app.log.error('Graceful teardown timed out, forcing exit');
      process.exit(1);
    }, 10000);

    try {
      await app.close();
      clearTimeout(timeout);
      app.log.info('Graceful teardown complete');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during teardown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
