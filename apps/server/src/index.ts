import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from '@vibecam/config';
import { createLogger } from '@vibecam/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@vibecam/types';
import { createApp } from './app.js';
import { RoomService } from './services/RoomService.js';
import { PeerService } from './services/PeerService.js';
import { ConnectionStateService } from './services/ConnectionStateService.js';
import { SignalingService } from './services/SignalingService.js';
import { HealthService } from './services/HealthService.js';
import { SocketService } from './services/SocketService.js';

/** Composition root: build config, services, wire Socket.IO, start listening. */
function main(): void {
  const config = loadConfig();
  const log = createLogger({ level: config.logLevel, scope: 'server', enabled: true });

  log.info(`starting vibecam server (env=${config.nodeEnv})`);

  // Services (dependency order matters; everything is plain DI).
  const rooms = new RoomService(config.maxRoomSize, log.child('RoomService'));
  const connStates = new ConnectionStateService();
  const peers = new PeerService(rooms, config.peerTimeout, config.heartbeatInterval, log.child('PeerService'));
  const health = new HealthService(rooms, connStates);

  const app = createApp(config, health, log.child('http'));
  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.socketCorsOrigin === '*' ? true : config.socketCorsOrigin.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Heartbeat at the transport layer too; app-level heartbeat covers liveness.
    pingInterval: Math.min(config.heartbeatInterval, 25000),
    pingTimeout: 20000,
  });

  const signaling = new SignalingService(io, rooms, log.child('SignalingService'));
  const socketService = new SocketService(io, rooms, peers, signaling, connStates, config, log.child('SocketService'));
  socketService.init();

  httpServer.listen(config.port, () => {
    log.info(`HTTP + Socket.IO listening on http://localhost:${config.port}`);
    if (config.nodeEnv === 'development') {
      log.info(`client dev server expected at ${config.clientUrl}`);
    }
  });

  const shutdown = (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    peers.stop();
    io.close();
    httpServer.close(() => process.exit(0));
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
