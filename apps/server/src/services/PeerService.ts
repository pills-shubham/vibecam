import type { Logger } from '@vibecam/shared';
import type { RoomService } from './RoomService.js';

export type TimeoutHandler = (roomId: string, peerId: string) => void;

/**
 * Tracks peer liveness. Clients send `heartbeat` periodically; if a peer's
 * lastSeen exceeds peerTimeout it is considered dead (e.g. crashed tab that
 * never fired a disconnect) and the registered handler is invoked to clean it
 * up. This is the safety net that prevents "ghost peers".
 */
export class PeerService {
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private onTimeout: TimeoutHandler | null = null;

  constructor(
    private readonly rooms: RoomService,
    private readonly peerTimeout: number,
    private readonly sweepInterval: number,
    private readonly log: Logger,
  ) {}

  start(onTimeout: TimeoutHandler): void {
    this.onTimeout = onTimeout;
    // Sweep at half the timeout so a dead peer is detected within ~1.5 cycles.
    const period = Math.max(5000, Math.floor(this.sweepInterval / 2));
    this.sweepTimer = setInterval(() => this.sweep(), period);
    // Do not keep the event loop alive solely for sweeping.
    this.sweepTimer.unref?.();
    this.log.info(`peer liveness sweeper started (period=${period}ms, timeout=${this.peerTimeout}ms)`);
  }

  stop(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  heartbeat(roomId: string, peerId: string): void {
    this.rooms.touch(roomId, peerId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const peer of this.rooms.allPeers()) {
      if (now - peer.lastSeen > this.peerTimeout) {
        this.log.warn(`peer ${peer.id} timed out (idle ${now - peer.lastSeen}ms)`);
        this.onTimeout?.(peer.roomId, peer.id);
      }
    }
  }
}
