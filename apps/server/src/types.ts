import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@vibecam/types';

/** Server-side socket.io aliases with our typed event maps applied. */
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Data we attach to each socket once it has joined a room. */
export interface SocketData {
  peerId?: string;
  roomId?: string;
}
