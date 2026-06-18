/**
 * Socket.IO event contract. Typed in both directions so client and server
 * share one source of truth. Adding an event here is the only place a new
 * signaling message should be declared.
 */
import type { PeerInfo, RoomInfo, StreamState, ConnectionQuality, PeerConnectionState } from './models.js';
import type { SdpPayload, IceCandidatePayload } from './signaling.js';

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  streamState: StreamState;
}

export interface JoinRoomResult {
  self: PeerInfo;
  room: RoomInfo;
}

export interface StreamStateChangedPayload {
  peerId: string;
  streamState: StreamState;
}

export interface ConnectionStatePayload {
  peerId: string;
  state: PeerConnectionState;
  quality: ConnectionQuality;
}

export interface FocusUserPayload {
  peerId: string;
}

export interface RaiseHandPayload {
  raised: boolean;
}

export interface PresenterChangedPayload {
  presenterId: string | null;
}

export interface ErrorPayload {
  code: 'ROOM_FULL' | 'BAD_REQUEST' | 'NOT_IN_ROOM' | 'INTERNAL';
  message: string;
}

/** Events the client emits -> server handles. */
export interface ClientToServerEvents {
  'join-room': (payload: JoinRoomPayload, ack: (result: JoinRoomResult | { error: ErrorPayload }) => void) => void;
  'leave-room': () => void;
  offer: (payload: SdpPayload) => void;
  answer: (payload: SdpPayload) => void;
  'ice-candidate': (payload: IceCandidatePayload) => void;
  heartbeat: () => void;
  'connection-state': (payload: ConnectionStatePayload) => void;
  'stream-state-changed': (payload: StreamState) => void;
  'focus-user': (payload: FocusUserPayload) => void;
  'raise-hand': (payload: RaiseHandPayload) => void;
  'become-presenter': () => void;
}

/** Events the server emits -> client handles. */
export interface ServerToClientEvents {
  'peer-joined': (peer: PeerInfo) => void;
  'peer-left': (peerId: string) => void;
  offer: (payload: SdpPayload) => void;
  answer: (payload: SdpPayload) => void;
  'ice-candidate': (payload: IceCandidatePayload) => void;
  'stream-state-changed': (payload: StreamStateChangedPayload) => void;
  'connection-state': (payload: ConnectionStatePayload) => void;
  'focus-user': (payload: FocusUserPayload & { from: string }) => void;
  'presenter-changed': (payload: PresenterChangedPayload) => void;
  'room-full': (payload: ErrorPayload) => void;
  error: (payload: ErrorPayload) => void;
}

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  HEARTBEAT: 'heartbeat',
  CONNECTION_STATE: 'connection-state',
  STREAM_STATE_CHANGED: 'stream-state-changed',
  FOCUS_USER: 'focus-user',
  RAISE_HAND: 'raise-hand',
  BECOME_PRESENTER: 'become-presenter',
  PRESENTER_CHANGED: 'presenter-changed',
} as const;
