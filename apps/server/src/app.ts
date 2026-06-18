import express, { type Express } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import type { AppConfig } from '@vibecam/types';
import type { Logger } from '@vibecam/shared';
import type { HealthService } from './services/HealthService.js';
import { createApiRouter } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the Express app: CORS, JSON, the API router, and — in production —
 * serving the built client with SPA fallback so `/room/:id` deep links work.
 */
export function createApp(config: AppConfig, health: HealthService, log: Logger): Express {
  const app = express();

  app.use(
    cors({
      origin: config.socketCorsOrigin === '*' ? true : config.socketCorsOrigin.split(','),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use('/', createApiRouter(config, health));

  // In production the API server also serves the static SPA bundle.
  const clientDist = resolve(__dirname, '../../client/dist');
  if (existsSync(clientDist)) {
    log.info(`serving client bundle from ${clientDist}`);
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(join(clientDist, 'index.html'));
    });
  } else if (config.nodeEnv === 'production') {
    log.warn('client bundle not found; run `npm run build` before `npm start`.');
  }

  return app;
}
