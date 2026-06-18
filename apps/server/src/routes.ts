import { Router } from 'express';
import type { AppConfig, PublicConfig } from '@vibecam/types';
import { toPublicConfig } from '@vibecam/config';
import type { HealthService } from './services/HealthService.js';

/**
 * HTTP API:
 *   GET /health  - liveness probe
 *   GET /config  - public runtime config (ICE servers etc.) for the browser
 *   GET /metrics - room/peer/quality counters
 */
export function createApiRouter(config: AppConfig, health: HealthService): Router {
  const router = Router();
  const publicConfig: PublicConfig = toPublicConfig(config);

  router.get('/health', (_req, res) => {
    res.json(health.health());
  });

  router.get('/config', (_req, res) => {
    res.json(publicConfig);
  });

  router.get('/metrics', (_req, res) => {
    res.json(health.metrics());
  });

  return router;
}
