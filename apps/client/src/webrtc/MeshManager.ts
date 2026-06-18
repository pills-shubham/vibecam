import type { PublicConfig, SdpPayload, IceCandidatePayload, PeerInfo } from '@vibecam/types';
import { buildRtcConfig } from '../config.js';
import { Emitter } from '../util/Emitter.js';
import { PeerConnection, type LocalMediaTracks, type MediaSlot } from './PeerConnection.js';
import type { ClientSocket } from '../net/SocketClient.js';

/** Supplies the current local tracks when a new PeerConnection is created. */
export interface LocalTrackSource {
  snapshot(): LocalMediaTracks;
}

type MeshEvents = {
  stream: { peerId: string; stream: MediaStream };
  state: { peerId: string; state: RTCPeerConnectionState };
};

/**
 * Maintains the full mesh of PeerConnections — one per remote peer. Owns
 * politeness assignment (deterministic by id comparison) and routes signaling
 * between the socket and the right PeerConnection.
 *
 * This is the seam for a future SFU: swap MeshManager for an SfuManager with
 * the same `add/remove/handle*` surface and the rest of the app is unchanged.
 */
export class MeshManager extends Emitter<MeshEvents> {
  private readonly peers = new Map<string, PeerConnection>();
  private readonly rtcConfig: RTCConfiguration;

  constructor(
    private readonly selfId: string,
    private readonly socket: ClientSocket,
    private readonly tracks: LocalTrackSource,
    config: PublicConfig,
  ) {
    super();
    this.rtcConfig = buildRtcConfig(config);
    this.wireSocket();
  }

  /** Open connections to everyone already in the room when we joined. */
  connectToExisting(existing: PeerInfo[]): void {
    for (const info of existing) {
      if (info.id !== this.selfId) this.addPeer(info.id);
    }
  }

  addPeer(peerId: string): PeerConnection {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    // Deterministic & opposite on each side: exactly one peer is polite.
    const polite = this.selfId < peerId;
    const conn = new PeerConnection(peerId, polite, this.rtcConfig, this.tracks.snapshot());

    conn.on('signal', ({ kind, description }) => {
      const payload: SdpPayload = { to: peerId, from: this.selfId, description };
      this.socket.emit(kind, payload);
    });
    conn.on('ice', (candidate) => {
      const payload: IceCandidatePayload = { to: peerId, from: this.selfId, candidate };
      this.socket.emit('ice-candidate', payload);
    });
    conn.on('stream', (stream) => this.emit('stream', { peerId, stream }));
    conn.on('state', (state) => this.emit('state', { peerId, state }));

    this.peers.set(peerId, conn);
    return conn;
  }

  removePeer(peerId: string): void {
    const conn = this.peers.get(peerId);
    if (!conn) return;
    conn.close();
    this.peers.delete(peerId);
  }

  get(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  all(): PeerConnection[] {
    return [...this.peers.values()];
  }

  /** Swap a published track slot across every peer at once. */
  async replaceSlot(slot: MediaSlot, track: MediaStreamTrack | null): Promise<void> {
    await Promise.all(this.all().map((c) => c.replaceTrack(slot, track)));
  }

  private wireSocket(): void {
    this.socket.on('offer', (p) => this.handleSdp(p));
    this.socket.on('answer', (p) => this.handleSdp(p));
    this.socket.on('ice-candidate', (p) => this.handleIce(p));
  }

  private handleSdp(payload: SdpPayload): void {
    // The sender may be a peer we haven't created yet (race on join order).
    const conn = this.peers.get(payload.from) ?? this.addPeer(payload.from);
    void conn.onRemoteDescription(payload);
  }

  private handleIce(payload: IceCandidatePayload): void {
    const conn = this.peers.get(payload.from);
    if (conn) void conn.onRemoteIce(payload);
  }

  dispose(): void {
    this.socket.off('offer');
    this.socket.off('answer');
    this.socket.off('ice-candidate');
    for (const conn of this.peers.values()) conn.close();
    this.peers.clear();
    this.clear();
  }
}
