import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, AppConfig } from '@vibecam/types';
import { createLogger } from '@vibecam/shared';
import { RoomService } from '../../src/services/RoomService.js';
import { PeerService } from '../../src/services/PeerService.js';
import { ConnectionStateService } from '../../src/services/ConnectionStateService.js';
import { SignalingService } from '../../src/services/SignalingService.js';
import { SocketService } from '../../src/services/SocketService.js';

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

const baseConfig: AppConfig = {
  port: 0,
  nodeEnv: 'test',
  clientUrl: '*',
  socketCorsOrigin: '*',
  stunUrls: [],
  heartbeatInterval: 30000,
  peerTimeout: 60000,
  maxRoomSize: 3,
  enableDebug: false,
  logLevel: 'error',
};

/** Boots a fully-wired Socket.IO server on an ephemeral port for tests. */
export async function startTestServer(overrides: Partial<AppConfig> = {}): Promise<TestServer> {
  const config: AppConfig = { ...baseConfig, ...overrides };
  const log = createLogger({ level: 'error', scope: 'test' });
  const http: HttpServer = createServer();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: { origin: '*' },
  });

  const rooms = new RoomService(config.maxRoomSize, log);
  const connStates = new ConnectionStateService();
  const peers = new PeerService(rooms, config.peerTimeout, config.heartbeatInterval, log);
  const signaling = new SignalingService(io, rooms, log);
  const socketService = new SocketService(io, rooms, peers, signaling, connStates, config, log);
  socketService.init();

  await new Promise<void>((resolve) => http.listen(0, resolve));
  const { port } = http.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    close: async () => {
      peers.stop();
      io.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
