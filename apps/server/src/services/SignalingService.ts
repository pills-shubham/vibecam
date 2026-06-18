import type { IceCandidatePayload, SdpPayload } from '@vibecam/types';
import type { Logger } from '@vibecam/shared';
import type { RoomService } from './RoomService.js';
import type { TypedServer, TypedSocket } from '../types.js';

/**
 * Relays WebRTC signaling between peers in the same room. The server is a dumb
 * pipe: it validates that both peers exist and share a room, then forwards the
 * opaque SDP/ICE to the target socket. It never inspects media descriptions.
 *
 * Designed as an interface seam: an SFU migration would replace this with a
 * service that terminates PeerConnections server-side, leaving SocketService
 * untouched.
 */
export class SignalingService {
  constructor(
    private readonly io: TypedServer,
    private readonly rooms: RoomService,
    private readonly log: Logger,
  ) {}

  relayOffer(socket: TypedSocket, payload: SdpPayload): void {
    this.relaySdp(socket, 'offer', payload);
  }

  relayAnswer(socket: TypedSocket, payload: SdpPayload): void {
    this.relaySdp(socket, 'answer', payload);
  }

  private relaySdp(socket: TypedSocket, kind: 'offer' | 'answer', payload: SdpPayload): void {
    const route = this.resolveRoute(socket, payload.to);
    if (!route) return;
    this.io.to(route.targetSocketId).emit(kind, { ...payload, from: route.fromPeerId });
    this.log.debug(`${kind} relayed ${route.fromPeerId} -> ${payload.to}`);
  }

  relayIceCandidate(socket: TypedSocket, payload: IceCandidatePayload): void {
    const route = this.resolveRoute(socket, payload.to);
    if (!route) return;
    this.io.to(route.targetSocketId).emit('ice-candidate', { ...payload, from: route.fromPeerId });
  }

  /**
   * Validate that the sender is in a room and the target peer is a real member
   * of that same room. Returns routing info or null if the message is bogus
   * (stale target, cross-room spoof, sender not joined).
   */
  private resolveRoute(
    socket: TypedSocket,
    targetPeerId: string,
  ): { fromPeerId: string; targetSocketId: string } | null {
    const sender = this.rooms.findPeerBySocket(socket.id);
    if (!sender) {
      this.log.warn(`signaling from non-member socket ${socket.id} dropped`);
      return null;
    }
    const target = this.rooms.getPeer(sender.roomId, targetPeerId);
    if (!target) {
      this.log.debug(`signaling target ${targetPeerId} not in room ${sender.roomId}; dropped`);
      return null;
    }
    return { fromPeerId: sender.id, targetSocketId: target.socketId };
  }
}
