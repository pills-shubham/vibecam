import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomService } from '../src/services/RoomService.js';
import { PeerService } from '../src/services/PeerService.js';
import { createLogger } from '@vibecam/shared';

const log = createLogger({ level: 'error', scope: 'test' });

describe('PeerService liveness sweeping', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('times out peers whose heartbeat lapsed and cleans them up', () => {
    const rooms = new RoomService(10, log);
    const peers = new PeerService(rooms, 1000, 1000, log);
    const peer = rooms.addPeer('r1', 's1', 'A');

    const onTimeout = vi.fn((roomId: string, peerId: string) => {
      rooms.removePeer(roomId, peerId);
    });
    peers.start(onTimeout);

    // Advance past timeout AND the sweep period (floored at 5000ms) with no heartbeat.
    vi.advanceTimersByTime(6000);
    expect(onTimeout).toHaveBeenCalledWith('r1', peer.id);
    expect(rooms.peerCount).toBe(0);
    peers.stop();
  });

  it('keeps peers alive while heartbeats arrive', () => {
    const rooms = new RoomService(10, log);
    const peers = new PeerService(rooms, 1000, 1000, log);
    const peer = rooms.addPeer('r1', 's1', 'A');
    const onTimeout = vi.fn();
    peers.start(onTimeout);

    // Heartbeat steadily across multiple sweep cycles (sweep period ~5000ms).
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(400);
      peers.heartbeat('r1', peer.id);
    }
    expect(onTimeout).not.toHaveBeenCalled();
    peers.stop();
  });
});
