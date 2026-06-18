import type { PublicConfig, StreamState } from '@vibecam/types';
import { SocketClient } from '../net/SocketClient.js';
import { MediaManager } from '../media/MediaManager.js';
import { VoiceActivityDetector } from '../media/VoiceActivityDetector.js';
import { MeshManager } from '../webrtc/MeshManager.js';
import { ConnectionMonitor } from '../webrtc/ConnectionMonitor.js';
import { RoomStore } from '../state/RoomStore.js';
import { RoomView } from '../ui/RoomView.js';
import type { Toasts } from '../ui/Toasts.js';
import { mediaErrorMessage } from './errors.js';

export interface JoinParams {
  displayName: string;
  systemAudio: boolean;
}

/**
 * Composition root for an active room session. Wires socket signaling, local
 * media, the WebRTC mesh, voice-activity detection, connection monitoring and
 * the UI together, and guarantees full teardown on leave/unload.
 */
export class RoomController {
  private readonly store = new RoomStore();
  private readonly socket = new SocketClient();
  private readonly media = new MediaManager();
  private readonly vad: VoiceActivityDetector;
  private mesh: MeshManager | null = null;
  private monitor: ConnectionMonitor | null = null;
  private view: RoomView | null = null;
  private displayName = '';
  private systemAudio = false;
  private joined = false;

  constructor(
    private readonly mount: HTMLElement,
    private readonly roomId: string,
    private readonly config: PublicConfig,
    private readonly toasts: Toasts,
  ) {
    this.vad = new VoiceActivityDetector((peerId, speaking) => this.store.setSpeaking(peerId, speaking));
    this.wireMediaEvents();
    this.wireConnectionLifecycle();
  }

  /** Acquire media, join the room, build the mesh and mount the UI. */
  async join(params: JoinParams): Promise<void> {
    this.displayName = params.displayName;
    this.systemAudio = params.systemAudio;

    await this.media.start({ systemAudio: params.systemAudio });

    const streamState = this.selfStreamState();
    const result = await this.socket.joinRoom({ roomId: this.roomId, displayName: this.displayName, streamState });

    this.store.addSelf(result.self.id, this.displayName, streamState, this.media.stream);
    this.vad.track(result.self.id, this.media.stream);

    this.mesh = new MeshManager(result.self.id, this.socket.socket, this.media, this.config);
    this.wireMesh();
    this.store.presenterId = result.room.presenterId;
    for (const peer of result.room.peers) {
      if (peer.id !== result.self.id) this.store.addPeer(peer);
    }
    this.mesh.connectToExisting(result.room.peers);

    this.monitor = new ConnectionMonitor(this.mesh, this.socket.socket, (id, state, quality) =>
      this.store.setQuality(id, quality, state),
    );
    this.monitor.start();
    this.socket.startHeartbeat(this.config.heartbeatInterval);

    this.mountView();
    this.wireRoomEvents();
    this.joined = true;
    this.toasts.success('Joined room');
  }

  private selfStreamState(): StreamState {
    return {
      micEnabled: this.media.isMicEnabled,
      screenSharing: this.media.isScreenSharing,
      systemAudio: this.systemAudio,
      handRaised: false,
    };
  }

  private mountView(): void {
    this.view = new RoomView(this.roomId, this.store, {
      toggleMic: () => this.toggleMic(),
      toggleScreen: () => void this.toggleScreen(),
      raiseHand: () => this.raiseHand(),
      becomePresenter: () => this.socket.socket.emit('become-presenter'),
      leave: () => this.leave(),
      copyLink: () => void this.copyLink(),
      focusPeer: (id) => this.store.toggleFocus(id),
      fullscreenPeer: (id) => void this.stageFullscreen(id),
    });
    this.mount.replaceChildren(this.view.root);
    this.syncControls();
  }

  private wireMesh(): void {
    if (!this.mesh) return;
    this.mesh.on('stream', ({ peerId, stream }) => {
      this.store.setStream(peerId, stream);
      this.vad.track(peerId, stream);
    });
    this.mesh.on('state', ({ peerId, state }) => {
      if (state === 'failed') this.toasts.warn(`Reconnecting to a peer…`);
      const vm = this.store.get(peerId);
      if (vm) this.store.setQuality(peerId, vm.quality, state === 'connected' ? 'connected' : vm.connState);
    });
  }

  private wireRoomEvents(): void {
    const s = this.socket.socket;
    s.on('peer-joined', (peer) => {
      this.store.addPeer(peer);
      this.mesh?.addPeer(peer.id);
      this.toasts.show(`${peer.displayName} joined`);
    });
    s.on('peer-left', (peerId) => {
      const vm = this.store.get(peerId);
      this.mesh?.removePeer(peerId);
      this.vad.untrack(peerId);
      this.store.removePeer(peerId);
      if (vm) this.toasts.show(`${vm.displayName} left`);
    });
    s.on('stream-state-changed', ({ peerId, streamState }) => this.store.setStreamState(peerId, streamState));
    s.on('presenter-changed', ({ presenterId }) => this.store.setPresenter(presenterId));
    s.on('focus-user', ({ peerId }) => this.store.toggleFocus(peerId));
    s.on('room-full', (e) => this.toasts.error(e.message));
    s.on('error', (e) => this.toasts.error(e.message));
  }

  private wireMediaEvents(): void {
    this.media.on('screen-ended', () => {
      this.toasts.warn('Screen sharing stopped');
      void this.mesh?.replaceSlot('screen', null);
      void this.mesh?.replaceSlot('systemAudio', null);
      this.broadcastStreamState();
      this.syncControls();
    });
  }

  private wireConnectionLifecycle(): void {
    this.socket.onDisconnect((reason) => {
      if (this.joined) this.toasts.warn(`Disconnected (${reason}). Reconnecting…`);
    });
    this.socket.onConnect(() => {
      if (this.joined) void this.rejoinAfterReconnect();
    });
    window.addEventListener('beforeunload', () => this.dispose());
  }

  // ---- user actions ----

  private toggleMic(): void {
    this.media.toggleMic();
    this.broadcastStreamState();
    this.syncControls();
  }

  private async toggleScreen(): Promise<void> {
    try {
      if (this.media.isScreenSharing) {
        this.media.stopScreen();
        await this.mesh?.replaceSlot('screen', null);
        await this.mesh?.replaceSlot('systemAudio', null);
      } else {
        await this.media.startScreen(this.systemAudio);
        await this.mesh?.replaceSlot('screen', this.media.screenTrack);
        await this.mesh?.replaceSlot('systemAudio', this.media.systemAudioTrack);
      }
      this.broadcastStreamState();
      this.syncControls();
    } catch (err) {
      this.toasts.error(mediaErrorMessage(err));
    }
  }

  private raiseHand(): void {
    const self = this.store.get(this.store.selfId);
    const raised = !self?.streamState.handRaised;
    this.socket.socket.emit('raise-hand', { raised });
  }

  private async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.toasts.success('Room link copied');
    } catch {
      this.toasts.warn('Could not copy link');
    }
  }

  private async stageFullscreen(id: string): Promise<void> {
    await this.view?.stage.getTile(id)?.requestFullscreen();
  }

  private broadcastStreamState(): void {
    const state = this.selfStreamState();
    const self = this.store.get(this.store.selfId);
    if (self) state.handRaised = self.streamState.handRaised;
    this.store.setStreamState(this.store.selfId, state);
    this.socket.socket.emit('stream-state-changed', state);
  }

  private syncControls(): void {
    this.view?.controls.setMic(this.media.isMicEnabled);
    this.view?.controls.setScreen(this.media.isScreenSharing);
    const self = this.store.get(this.store.selfId);
    this.view?.controls.setHand(!!self?.streamState.handRaised);
  }

  /** Rebuild the session after a socket reconnect (server dropped our peer). */
  private async rejoinAfterReconnect(): Promise<void> {
    this.monitor?.stop();
    this.mesh?.dispose();
    for (const vm of this.store.list()) {
      if (!vm.isSelf) this.store.removePeer(vm.id);
    }
    try {
      const result = await this.socket.joinRoom({
        roomId: this.roomId,
        displayName: this.displayName,
        streamState: this.selfStreamState(),
      });
      this.store.selfId = result.self.id;
      this.mesh = new MeshManager(result.self.id, this.socket.socket, this.media, this.config);
      this.wireMesh();
      for (const peer of result.room.peers) {
        if (peer.id !== result.self.id) this.store.addPeer(peer);
      }
      this.mesh.connectToExisting(result.room.peers);
      this.monitor = new ConnectionMonitor(this.mesh, this.socket.socket, (id, state, q) =>
        this.store.setQuality(id, q, state),
      );
      this.monitor.start();
      this.toasts.success('Reconnected');
    } catch (err) {
      this.toasts.error(mediaErrorMessage(err));
    }
  }

  private leave(): void {
    this.dispose();
    window.location.href = '/';
  }

  dispose(): void {
    if (!this.joined && !this.mesh) return;
    this.joined = false;
    this.socket.leaveRoom();
    this.monitor?.dispose();
    this.mesh?.dispose();
    this.vad.dispose();
    this.media.dispose();
    this.socket.dispose();
    this.view?.dispose();
  }
}
