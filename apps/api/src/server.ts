import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function start(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);

  await app.listen({ host: '0.0.0.0', port: env.API_PORT });

  const close = async (): Promise<void> => {
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

start().catch((error: unknown) => {
  console.error('Fastify API 启动失败', error);
  process.exit(1);
});
