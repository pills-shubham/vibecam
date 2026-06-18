import { describe, it, expect, beforeEach } from 'vitest';
import { RoomService } from '../src/services/RoomService.js';
import { createLogger } from '@vibecam/shared';

const log = createLogger({ level: 'error', scope: 'test' });

describe('RoomService', () => {
  let rooms: RoomService;
  beforeEach(() => {
    rooms = new RoomService(3, log);
  });

  it('adds and lists peers', () => {
    const a = rooms.addPeer('r1', 'sock-a', 'Alice');
    const b = rooms.addPeer('r1', 'sock-b', 'Bob');
    expect(rooms.peerCount).toBe(2);
    const ids = rooms.listPeers('r1').map((p) => p.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it('enforces capacity', () => {
    rooms.addPeer('r1', 's1', 'A');
    rooms.addPeer('r1', 's2', 'B');
    rooms.addPeer('r1', 's3', 'C');
    expect(rooms.hasCapacity('r1')).toBe(false);
  });

  it('destroys empty rooms (no ghost rooms)', () => {
    const p = rooms.addPeer('r1', 's1', 'A');
    rooms.removePeer('r1', p.id);
    expect(rooms.roomCount).toBe(0);
    expect(rooms.getRoomInfo('r1')).toBeUndefined();
  });

  it('clears presenter when the presenter leaves', () => {
    const p = rooms.addPeer('r1', 's1', 'A');
    rooms.addPeer('r1', 's2', 'B');
    rooms.setPresenter('r1', p.id);
    expect(rooms.getRoomInfo('r1')?.presenterId).toBe(p.id);
    rooms.removePeer('r1', p.id);
    expect(rooms.getRoomInfo('r1')?.presenterId).toBeNull();
  });

  it('finds peers by socket id', () => {
    const p = rooms.addPeer('r1', 'sock-x', 'X');
    expect(rooms.findPeerBySocket('sock-x')?.id).toBe(p.id);
    expect(rooms.findPeerBySocket('nope')).toBeUndefined();
  });

  it('updates stream + hand state', () => {
    const p = rooms.addPeer('r1', 's1', 'A');
    rooms.updateStreamState('r1', p.id, {
      micEnabled: false,
      screenSharing: true,
      systemAudio: true,
      handRaised: true,
    });
    const got = rooms.getPeer('r1', p.id)!;
    expect(got.streamState.handRaised).toBe(true);
    expect(got.streamState.micEnabled).toBe(false);
  });
});
