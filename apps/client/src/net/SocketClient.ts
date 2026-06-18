import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  JoinRoomResult,
  ErrorPayload,
} from '@vibecam/types';
import { SERVER_URL } from '../config.js';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Thin wrapper over the Socket.IO client. Owns connection lifecycle and the
 * app-level heartbeat. All signaling/event wiring is done by callers binding
 * to `socket` directly (typed via the shared event maps).
 */
export class SocketClient {
  readonly socket: ClientSocket;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.socket = io(SERVER_URL || '/', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });
  }

  onConnect(cb: () => void): void {
    this.socket.on('connect', cb);
  }
  onDisconnect(cb: (reason: string) => void): void {
    this.socket.on('disconnect', cb);
  }

  /** Join a room; resolves with room state or rejects with a typed error. */
  joinRoom(payload: JoinRoomPayload): Promise<JoinRoomResult> {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-room', payload, (result) => {
        if ('error' in result) reject(result.error as ErrorPayload);
        else resolve(result);
      });
    });
  }

  leaveRoom(): void {
    this.socket.emit('leave-room');
  }

  startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket.connected) this.socket.emit('heartbeat');
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  dispose(): void {
    this.stopHeartbeat();
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
