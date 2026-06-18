import type { AppConfig, LogLevel, PublicConfig } from '@vibecam/types';
import { readBool, readList, readNumber, readString } from './env.js';

const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function readLogLevel(fallback: LogLevel): LogLevel {
  const raw = readString('LOG_LEVEL', fallback).toLowerCase() as LogLevel;
  return VALID_LOG_LEVELS.includes(raw) ? raw : fallback;
}

function readNodeEnv(): AppConfig['nodeEnv'] {
  const raw = readString('NODE_ENV', 'development');
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

/**
 * ConfigService: builds the immutable AppConfig from the environment exactly
 * once. All defaults mirror .env.example so the app runs with zero config.
 */
export function loadConfig(): AppConfig {
  return {
    port: readNumber('PORT', 3000),
    nodeEnv: readNodeEnv(),
    clientUrl: readString('CLIENT_URL', 'http://localhost:5173'),
    socketCorsOrigin: readString('SOCKET_CORS_ORIGIN', 'http://localhost:5173'),
    stunUrls: readList('STUN_URL', ['stun:stun.l.google.com:19302']),
    heartbeatInterval: readNumber('HEARTBEAT_INTERVAL', 30000),
    peerTimeout: readNumber('PEER_TIMEOUT', 60000),
    maxRoomSize: readNumber('MAX_ROOM_SIZE', 10),
    enableDebug: readBool('ENABLE_DEBUG', true),
    logLevel: readLogLevel('info'),
  };
}

/** Strip secrets/internal fields for the browser-facing /config endpoint. */
export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    stunUrls: config.stunUrls,
    heartbeatInterval: config.heartbeatInterval,
    peerTimeout: config.peerTimeout,
    maxRoomSize: config.maxRoomSize,
    enableDebug: config.enableDebug,
  };
}

export * from './env.js';
