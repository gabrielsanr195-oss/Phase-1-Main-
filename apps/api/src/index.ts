import { buildApp } from './app';
import { config } from './config';

async function start() {
  const app = await buildApp();
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
