import type { ConnectionQuality, PeerConnectionState } from '@vibecam/types';
import { QUALITY_THRESHOLDS } from '@vibecam/shared';
import type { MeshManager } from './MeshManager.js';
import type { ClientSocket } from '../net/SocketClient.js';

type QualityCallback = (peerId: string, state: PeerConnectionState, quality: ConnectionQuality) => void;

interface PrevStat {
  packetsLost: number;
  packetsReceived: number;
}

/**
 * Polls RTCStats for every peer connection and derives a coarse quality bucket
 * from packet loss and round-trip time. Reports changes locally (UI) and to the
 * server (so /metrics and remote peers can reflect link health).
 */
export class ConnectionMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly prev = new Map<string, PrevStat>();

  constructor(
    private readonly mesh: MeshManager,
    private readonly socket: ClientSocket,
    private readonly onChange: QualityCallback,
    private readonly intervalMs = 3000,
  ) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async poll(): Promise<void> {
    for (const conn of this.mesh.all()) {
      const state = this.mapState(conn.pc.connectionState);
      const quality = state === 'disconnected' ? 'disconnected' : await this.measure(conn.peerId, conn.pc);
      this.onChange(conn.peerId, state, quality);
      this.socket.emit('connection-state', { peerId: conn.peerId, state, quality });
    }
  }

  private async measure(peerId: string, pc: RTCPeerConnection): Promise<ConnectionQuality> {
    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let lossRatio = 0;
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report as RTCIceCandidatePairStats).nominated) {
          rtt = ((report as RTCIceCandidatePairStats).currentRoundTripTime ?? 0) * 1000;
        }
        if (report.type === 'inbound-rtp') {
          const r = report as RTCInboundRtpStreamStats;
          const lost = r.packetsLost ?? 0;
          const recv = (r as unknown as { packetsReceived?: number }).packetsReceived ?? 0;
          const prev = this.prev.get(peerId) ?? { packetsLost: 0, packetsReceived: 0 };
          const dLost = Math.max(0, lost - prev.packetsLost);
          const dRecv = Math.max(0, recv - prev.packetsReceived);
          lossRatio = dRecv + dLost > 0 ? dLost / (dRecv + dLost) : 0;
          this.prev.set(peerId, { packetsLost: lost, packetsReceived: recv });
        }
      });
      return this.bucket(lossRatio, rtt);
    } catch {
      return 'good';
    }
  }

  private bucket(loss: number, rtt: number): ConnectionQuality {
    const t = QUALITY_THRESHOLDS;
    if (loss <= t.excellent.maxLoss && rtt <= t.excellent.maxRtt) return 'excellent';
    if (loss <= t.good.maxLoss && rtt <= t.good.maxRtt) return 'good';
    if (loss <= t.poor.maxLoss && rtt <= t.poor.maxRtt) return 'poor';
    return 'poor';
  }

  private mapState(s: RTCPeerConnectionState): PeerConnectionState {
    switch (s) {
      case 'new':
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'reconnecting';
      case 'failed':
        return 'failed';
      case 'closed':
        return 'closed';
      default:
        return 'new';
    }
  }

  dispose(): void {
    this.stop();
    this.prev.clear();
  }
}
