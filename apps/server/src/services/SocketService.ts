import type {
  AppConfig,
  ErrorPayload,
  JoinRoomPayload,
  JoinRoomResult,
  RaiseHandPayload,
  StreamState,
  ConnectionStatePayload,
  FocusUserPayload,
} from '@vibecam/types';
import { isValidRoomId, sanitizeDisplayName, isValidDisplayName, normalizeRoomId } from '@vibecam/shared';
import type { Logger } from '@vibecam/shared';
import type { RoomService } from './RoomService.js';
import type { PeerService } from './PeerService.js';
import type { SignalingService } from './SignalingService.js';
import type { ConnectionStateService } from './ConnectionStateService.js';
import type { TypedServer, TypedSocket } from '../types.js';

/**
 * Glue between Socket.IO and the domain services. Owns the per-connection
 * event handlers and the room join/leave lifecycle. Keeps zero state of its
 * own — everything lives in RoomService — so cleanup is deterministic.
 */
export class SocketService {
  constructor(
    private readonly io: TypedServer,
    private readonly rooms: RoomService,
    private readonly peers: PeerService,
    private readonly signaling: SignalingService,
    private readonly connStates: ConnectionStateService,
    private readonly config: AppConfig,
    private readonly log: Logger,
  ) {}

  init(): void {
    // PeerService timeouts funnel through the same teardown path as disconnect.
    this.peers.start((roomId, peerId) => this.teardownPeer(roomId, peerId, 'timeout'));
    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  private onConnection(socket: TypedSocket): void {
    this.log.debug(`socket connected: ${socket.id}`);

    socket.on('join-room', (payload, ack) => this.onJoin(socket, payload, ack));
    socket.on('leave-room', () => this.onLeave(socket));
    socket.on('heartbeat', () => this.onHeartbeat(socket));
    socket.on('offer', (p) => this.signaling.relayOffer(socket, p));
    socket.on('answer', (p) => this.signaling.relayAnswer(socket, p));
    socket.on('ice-candidate', (p) => this.signaling.relayIceCandidate(socket, p));
    socket.on('stream-state-changed', (s) => this.onStreamState(socket, s));
    socket.on('connection-state', (p) => this.onConnectionState(socket, p));
    socket.on('focus-user', (p) => this.onFocusUser(socket, p));
    socket.on('raise-hand', (p) => this.onRaiseHand(socket, p));
    socket.on('become-presenter', () => this.onBecomePresenter(socket));
    socket.on('disconnect', (reason) => {
      this.log.debug(`socket ${socket.id} disconnected: ${reason}`);
      this.onLeave(socket);
    });
  }

  private fail(ack: (r: { error: ErrorPayload }) => void, code: ErrorPayload['code'], message: string): void {
    ack({ error: { code, message } });
  }

  private onJoin(
    socket: TypedSocket,
    payload: JoinRoomPayload,
    ack: (result: JoinRoomResult | { error: ErrorPayload }) => void,
  ): void {
    const roomId = normalizeRoomId(payload?.roomId ?? '');
    const displayName = sanitizeDisplayName(payload?.displayName ?? '');

    if (!isValidRoomId(roomId)) return this.fail(ack, 'BAD_REQUEST', 'Invalid room id.');
    if (!isValidDisplayName(displayName)) return this.fail(ack, 'BAD_REQUEST', 'Invalid display name.');
    if (!this.rooms.hasCapacity(roomId)) {
      socket.emit('room-full', { code: 'ROOM_FULL', message: `Room is full (max ${this.config.maxRoomSize}).` });
      return this.fail(ack, 'ROOM_FULL', `Room is full (max ${this.config.maxRoomSize}).`);
    }

    // A socket may only be in one room; drop any prior membership first.
    this.onLeave(socket);

    const streamState = this.coerceStreamState(payload?.streamState);
    const peer = this.rooms.addPeer(roomId, socket.id, displayName, streamState);
    socket.data.peerId = peer.id;
    socket.data.roomId = roomId;
    void socket.join(roomId);

    // Tell existing members about the newcomer.
    socket.to(roomId).emit('peer-joined', {
      id: peer.id,
      displayName: peer.displayName,
      joinedAt: peer.joinedAt,
      streamState: peer.streamState,
    });

    const room = this.rooms.getRoomInfo(roomId)!;
    ack({ self: { id: peer.id, displayName: peer.displayName, joinedAt: peer.joinedAt, streamState: peer.streamState }, room });
    this.log.info(`${displayName} joined ${roomId} (peer=${peer.id})`);
  }

  private onLeave(socket: TypedSocket): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    socket.data.peerId = undefined;
    socket.data.roomId = undefined;
    void socket.leave(roomId);
    this.teardownPeer(roomId, peerId, 'leave');
  }

  /** Single cleanup path for leave / disconnect / timeout — no ghost peers. */
  private teardownPeer(roomId: string, peerId: string, cause: string): void {
    const removed = this.rooms.removePeer(roomId, peerId);
    if (!removed) return;
    this.connStates.remove(peerId);
    this.io.to(roomId).emit('peer-left', peerId);
    // If the presenter left, broadcast the cleared presenter slot.
    const info = this.rooms.getRoomInfo(roomId);
    if (info && info.presenterId === null) {
      this.io.to(roomId).emit('presenter-changed', { presenterId: null });
    }
    this.log.info(`peer ${peerId} torn down from ${roomId} (${cause})`);
  }

  private onHeartbeat(socket: TypedSocket): void {
    const { roomId, peerId } = socket.data;
    if (roomId && peerId) this.peers.heartbeat(roomId, peerId);
  }

  private onStreamState(socket: TypedSocket, state: StreamState): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    const next = this.coerceStreamState(state);
    const peer = this.rooms.updateStreamState(roomId, peerId, next);
    if (!peer) return;
    this.io.to(roomId).emit('stream-state-changed', { peerId, streamState: peer.streamState });
  }

  private onConnectionState(socket: TypedSocket, payload: ConnectionStatePayload): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    this.connStates.update(peerId, payload.state, payload.quality);
    // Relay so the *remote* peer can render this peer's view of the link.
    socket.to(roomId).emit('connection-state', { ...payload, peerId });
  }

  private onFocusUser(socket: TypedSocket, payload: FocusUserPayload): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    socket.to(roomId).emit('focus-user', { peerId: payload.peerId, from: peerId });
  }

  private onRaiseHand(socket: TypedSocket, payload: RaiseHandPayload): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    const peer = this.rooms.getPeer(roomId, peerId);
    if (!peer) return;
    const next: StreamState = { ...peer.streamState, handRaised: !!payload.raised };
    this.rooms.updateStreamState(roomId, peerId, next);
    this.io.to(roomId).emit('stream-state-changed', { peerId, streamState: next });
  }

  private onBecomePresenter(socket: TypedSocket): void {
    const { roomId, peerId } = socket.data;
    if (!roomId || !peerId) return;
    const info = this.rooms.setPresenter(roomId, peerId);
    if (info) this.io.to(roomId).emit('presenter-changed', { presenterId: info.presenterId });
  }

  /** Defensive: never trust client booleans verbatim; camera stays off always. */
  private coerceStreamState(state: Partial<StreamState> | undefined): StreamState {
    return {
      micEnabled: !!state?.micEnabled,
      screenSharing: !!state?.screenSharing,
      systemAudio: !!state?.systemAudio,
      handRaised: !!state?.handRaised,
    };
  }
}
