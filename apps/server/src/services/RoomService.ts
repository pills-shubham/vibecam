import type { Peer, PeerInfo, RoomInfo, StreamState } from '@vibecam/types';
import { DEFAULT_STREAM_STATE, toPeerInfo } from '@vibecam/types';
import { generateId, type Logger } from '@vibecam/shared';

interface Room {
  id: string;
  createdAt: number;
  presenterId: string | null;
  peers: Map<string, Peer>;
}

/**
 * In-memory room registry. Holds the authoritative set of rooms and the peers
 * inside them. Pure data ops only — no socket knowledge — so it stays testable
 * and could be swapped for a Redis-backed store when migrating to an SFU.
 */
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly maxRoomSize: number,
    private readonly log: Logger,
  ) {}

  hasCapacity(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return !room || room.peers.size < this.maxRoomSize;
  }

  private getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { id: roomId, createdAt: Date.now(), presenterId: null, peers: new Map() };
      this.rooms.set(roomId, room);
      this.log.info(`room created: ${roomId}`);
    }
    return room;
  }

  addPeer(roomId: string, socketId: string, displayName: string, streamState?: StreamState): Peer {
    const room = this.getOrCreateRoom(roomId);
    const now = Date.now();
    const peer: Peer = {
      id: generateId('peer'),
      socketId,
      displayName,
      roomId,
      joinedAt: now,
      lastSeen: now,
      streamState: streamState ?? { ...DEFAULT_STREAM_STATE },
    };
    room.peers.set(peer.id, peer);
    this.log.debug(`peer ${peer.id} (${displayName}) joined ${roomId}; size=${room.peers.size}`);
    return peer;
  }

  removePeer(roomId: string, peerId: string): Peer | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const peer = room.peers.get(peerId);
    if (!peer) return undefined;
    room.peers.delete(peerId);
    if (room.presenterId === peerId) room.presenterId = null;
    this.log.debug(`peer ${peerId} removed from ${roomId}; size=${room.peers.size}`);
    if (room.peers.size === 0) {
      this.rooms.delete(roomId);
      this.log.info(`room destroyed (empty): ${roomId}`);
    }
    return peer;
  }

  getPeer(roomId: string, peerId: string): Peer | undefined {
    return this.rooms.get(roomId)?.peers.get(peerId);
  }

  findPeerBySocket(socketId: string): Peer | undefined {
    for (const room of this.rooms.values()) {
      for (const peer of room.peers.values()) {
        if (peer.socketId === socketId) return peer;
      }
    }
    return undefined;
  }

  listPeers(roomId: string): PeerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return [...room.peers.values()].map(toPeerInfo);
  }

  /** Peers other than `exceptPeerId` — used to fan out a new joiner. */
  otherPeers(roomId: string, exceptPeerId: string): Peer[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return [...room.peers.values()].filter((p) => p.id !== exceptPeerId);
  }

  updateStreamState(roomId: string, peerId: string, streamState: StreamState): Peer | undefined {
    const peer = this.getPeer(roomId, peerId);
    if (!peer) return undefined;
    peer.streamState = streamState;
    return peer;
  }

  setPresenter(roomId: string, peerId: string | null): RoomInfo | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    if (peerId !== null && !room.peers.has(peerId)) return undefined;
    room.presenterId = peerId;
    this.log.info(`presenter for ${roomId} -> ${peerId ?? 'none'}`);
    return this.getRoomInfo(roomId);
  }

  touch(roomId: string, peerId: string): void {
    const peer = this.getPeer(roomId, peerId);
    if (peer) peer.lastSeen = Date.now();
  }

  getRoomInfo(roomId: string): RoomInfo | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return {
      id: room.id,
      peers: this.listPeers(roomId),
      presenterId: room.presenterId,
      createdAt: room.createdAt,
    };
  }

  /** Flat list of every peer across all rooms (timeout sweeping, metrics). */
  allPeers(): Peer[] {
    const out: Peer[] = [];
    for (const room of this.rooms.values()) out.push(...room.peers.values());
    return out;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get peerCount(): number {
    let n = 0;
    for (const room of this.rooms.values()) n += room.peers.size;
    return n;
  }
}
