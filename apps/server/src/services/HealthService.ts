import type { RoomService } from './RoomService.js';
import type { ConnectionStateService } from './ConnectionStateService.js';

export interface HealthReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface MetricsReport {
  uptimeSeconds: number;
  rooms: number;
  peers: number;
  connectionQuality: Record<string, number>;
  memory: {
    rssMb: number;
    heapUsedMb: number;
  };
}

/**
 * Produces health and metrics snapshots. Read-only over the other services so
 * the HTTP routes stay trivial.
 */
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly rooms: RoomService,
    private readonly connStates: ConnectionStateService,
  ) {}

  private uptime(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  health(): HealthReport {
    return {
      status: 'ok',
      uptimeSeconds: this.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  metrics(): MetricsReport {
    const mem = process.memoryUsage();
    const toMb = (n: number) => Math.round((n / 1024 / 1024) * 100) / 100;
    return {
      uptimeSeconds: this.uptime(),
      rooms: this.rooms.roomCount,
      peers: this.rooms.peerCount,
      connectionQuality: this.connStates.qualityBreakdown(),
      memory: { rssMb: toMb(mem.rss), heapUsedMb: toMb(mem.heapUsed) },
    };
  }
}
