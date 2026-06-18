import type { ConnectionQuality, PeerConnectionState } from '@vibecam/types';

interface StateEntry {
  state: PeerConnectionState;
  quality: ConnectionQuality;
  updatedAt: number;
}

/**
 * Aggregates the connection-state reports peers send about their links. The
 * server is a mesh signaler and never sees media, so this is the only place it
 * learns how healthy the P2P connections are — surfaced via /metrics.
 */
export class ConnectionStateService {
  private readonly states = new Map<string, StateEntry>();

  update(peerId: string, state: PeerConnectionState, quality: ConnectionQuality): void {
    this.states.set(peerId, { state, quality, updatedAt: Date.now() });
  }

  remove(peerId: string): void {
    this.states.delete(peerId);
  }

  get(peerId: string): StateEntry | undefined {
    return this.states.get(peerId);
  }

  /** Count peers grouped by reported quality bucket, for metrics. */
  qualityBreakdown(): Record<ConnectionQuality, number> {
    const out: Record<ConnectionQuality, number> = {
      excellent: 0,
      good: 0,
      poor: 0,
      disconnected: 0,
    };
    for (const entry of this.states.values()) out[entry.quality] += 1;
    return out;
  }
}
