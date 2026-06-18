/**
 * Domain models shared between client and server.
 * These describe rooms, peers and their advertised media/UI state.
 */

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * Media/UI flags a peer advertises about itself over the signaling channel.
 * WebRTC carries the actual media; this carries the *intent* + UI status so
 * remote peers can render badges without inspecting tracks.
 */
export interface StreamState {
  micEnabled: boolean;
  screenSharing: boolean;
  systemAudio: boolean;
  handRaised: boolean;
}

export const DEFAULT_STREAM_STATE: StreamState = {
  micEnabled: true,
  screenSharing: false,
  systemAudio: false,
  handRaised: false,
};

/** A participant as the server tracks it. */
export interface Peer {
  id: string;
  socketId: string;
  displayName: string;
  roomId: string;
  joinedAt: number;
  lastSeen: number;
  streamState: StreamState;
}

/** Public view of a peer broadcast to others (no socket internals leaked). */
export interface PeerInfo {
  id: string;
  displayName: string;
  joinedAt: number;
  streamState: StreamState;
}

export interface RoomInfo {
  id: string;
  peers: PeerInfo[];
  presenterId: string | null;
  createdAt: number;
}

export function toPeerInfo(peer: Peer): PeerInfo {
  return {
    id: peer.id,
    displayName: peer.displayName,
    joinedAt: peer.joinedAt,
    streamState: peer.streamState,
  };
}
