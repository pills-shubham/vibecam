import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { startTestServer, type TestServer } from './helpers/testServer.js';
import type { JoinRoomResult, ErrorPayload } from '@vibecam/types';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});
afterAll(async () => {
  await server.close();
});

function connect(): Socket {
  return io(server.url, { transports: ['websocket'], forceNew: true });
}

function join(socket: Socket, roomId: string, name: string): Promise<JoinRoomResult> {
  return new Promise((resolve, reject) => {
    socket.emit(
      'join-room',
      { roomId, displayName: name, streamState: { micEnabled: true, screenSharing: true, systemAudio: false, handRaised: false } },
      (res: JoinRoomResult | { error: ErrorPayload }) => {
        if ('error' in res) reject(res.error);
        else resolve(res);
      },
    );
  });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve as (v: T) => void));
}

describe('signaling integration', () => {
  it('notifies existing peers when a new peer joins', async () => {
    const a = connect();
    const b = connect();
    const first = await join(a, 'room-x', 'Alice');
    expect(first.room.peers).toHaveLength(1);

    const joinedPromise = once<{ id: string; displayName: string }>(a, 'peer-joined');
    await join(b, 'room-x', 'Bob');
    const joined = await joinedPromise;
    expect(joined.displayName).toBe('Bob');

    a.close();
    b.close();
  });

  it('relays an offer from one peer to the targeted peer only', async () => {
    const a = connect();
    const b = connect();
    const ra = await join(a, 'room-relay', 'A');
    const rb = await join(b, 'room-relay', 'B');

    const offerPromise = once<{ from: string; description: { type: string } }>(b, 'offer');
    a.emit('offer', { to: rb.self.id, from: ra.self.id, description: { type: 'offer', sdp: 'x' } });
    const offer = await offerPromise;
    expect(offer.from).toBe(ra.self.id);
    expect(offer.description.type).toBe('offer');

    a.close();
    b.close();
  });

  it('emits peer-left and cleans up when a socket disconnects (no ghost peers)', async () => {
    const a = connect();
    const b = connect();
    const ra = await join(a, 'room-leave', 'A');
    await join(b, 'room-leave', 'B');

    const leftPromise = once<string>(b, 'peer-left');
    a.close(); // simulate refresh / tab close
    const leftId = await leftPromise;
    expect(leftId).toBe(ra.self.id);

    b.close();
  });

  it('rejects joining a full room', async () => {
    const sockets = [connect(), connect(), connect(), connect()];
    await join(sockets[0], 'room-full', 'A');
    await join(sockets[1], 'room-full', 'B');
    await join(sockets[2], 'room-full', 'C');
    await expect(join(sockets[3], 'room-full', 'D')).rejects.toMatchObject({ code: 'ROOM_FULL' });
    sockets.forEach((s) => s.close());
  });
});
