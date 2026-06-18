import type {
  ConnectionQuality,
  PeerConnectionState,
  PeerInfo,
  StreamState,
} from '@vibecam/types';
import { DEFAULT_STREAM_STATE } from '@vibecam/types';
import { Emitter } from '../util/Emitter.js';

export interface ParticipantVM {
  id: string;
  displayName: string;
  isSelf: boolean;
  streamState: StreamState;
  stream: MediaStream | null;
  speaking: boolean;
  quality: ConnectionQuality;
  connState: PeerConnectionState;
}

export type LayoutMode = 'grid' | 'focus';

type StoreEvents = {
  added: ParticipantVM;
  removed: string;
  updated: ParticipantVM;
  layout: void;
};

/**
 * Single source of truth for what the UI renders. Holds participant view
 * models plus layout flags (focus/presenter/compact/sidebar) and emits granular
 * events so components patch only what changed — avoiding full re-renders.
 */
export class RoomStore extends Emitter<StoreEvents> {
  private readonly participants = new Map<string, ParticipantVM>();
  selfId = '';
  presenterId: string | null = null;
  focusedId: string | null = null;
  layout: LayoutMode = 'grid';
  compact = false;
  sidebarVisible = true;

  list(): ParticipantVM[] {
    // Self first, then by join is implicit via insertion order.
    return [...this.participants.values()].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
  }

  get(id: string): ParticipantVM | undefined {
    return this.participants.get(id);
  }

  get size(): number {
    return this.participants.size;
  }

  addSelf(id: string, displayName: string, streamState: StreamState, stream: MediaStream): void {
    this.selfId = id;
    const vm: ParticipantVM = {
      id,
      displayName,
      isSelf: true,
      streamState,
      stream,
      speaking: false,
      quality: 'excellent',
      connState: 'connected',
    };
    this.participants.set(id, vm);
    this.emit('added', vm);
  }

  addPeer(info: PeerInfo): void {
    if (this.participants.has(info.id)) return;
    const vm: ParticipantVM = {
      id: info.id,
      displayName: info.displayName,
      isSelf: false,
      streamState: info.streamState ?? { ...DEFAULT_STREAM_STATE },
      stream: null,
      speaking: false,
      quality: 'good',
      connState: 'connecting',
    };
    this.participants.set(info.id, vm);
    this.emit('added', vm);
  }

  removePeer(id: string): void {
    if (!this.participants.delete(id)) return;
    if (this.focusedId === id) {
      this.focusedId = null;
      this.layout = 'grid';
    }
    if (this.presenterId === id) this.presenterId = null;
    this.emit('removed', id);
    this.emit('layout', undefined);
  }

  private patch(id: string, fn: (vm: ParticipantVM) => void): void {
    const vm = this.participants.get(id);
    if (!vm) return;
    fn(vm);
    this.emit('updated', vm);
  }

  setStream(id: string, stream: MediaStream): void {
    this.patch(id, (vm) => (vm.stream = stream));
  }
  setStreamState(id: string, streamState: StreamState): void {
    this.patch(id, (vm) => (vm.streamState = streamState));
  }
  setSpeaking(id: string, speaking: boolean): void {
    const vm = this.participants.get(id);
    if (vm && vm.speaking !== speaking) this.patch(id, (v) => (v.speaking = speaking));
  }
  setQuality(id: string, quality: ConnectionQuality, connState: PeerConnectionState): void {
    this.patch(id, (vm) => {
      vm.quality = quality;
      vm.connState = connState;
    });
  }

  setPresenter(presenterId: string | null): void {
    this.presenterId = presenterId;
    if (presenterId && this.layout === 'grid' && presenterId !== this.selfId) {
      this.focusedId = presenterId;
      this.layout = 'focus';
    }
    this.emit('layout', undefined);
  }

  toggleFocus(id: string): void {
    if (this.layout === 'focus' && this.focusedId === id) {
      this.layout = 'grid';
      this.focusedId = null;
    } else {
      this.layout = 'focus';
      this.focusedId = id;
    }
    this.emit('layout', undefined);
  }

  setCompact(on: boolean): void {
    this.compact = on;
    this.emit('layout', undefined);
  }
  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    this.emit('layout', undefined);
  }
}
