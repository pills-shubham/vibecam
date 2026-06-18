import { Emitter } from '../util/Emitter.js';

export interface MediaStartOptions {
  systemAudio: boolean;
}

type MediaEvents = {
  'screen-ended': void;
  'tracks-changed': void;
};

/**
 * Owns the local media: a microphone audio track (on by default) and a screen
 * share (video + optional system audio). The camera is never requested — this
 * is a screen-sharing-first product.
 *
 * Exposes a single outbound MediaStream whose tracks are what we publish to all
 * peers, so swapping a screen track in/out is a track-replacement, not a
 * stream rebuild.
 */
export class MediaManager extends Emitter<MediaEvents> {
  private micStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private readonly outbound = new MediaStream();

  get stream(): MediaStream {
    return this.outbound;
  }

  get micTrack(): MediaStreamTrack | null {
    return this.micStream?.getAudioTracks()[0] ?? null;
  }

  get screenTrack(): MediaStreamTrack | null {
    return this.screenStream?.getVideoTracks()[0] ?? null;
  }

  /** Optional system-audio track captured alongside the screen share. */
  get systemAudioTrack(): MediaStreamTrack | null {
    return this.screenStream?.getAudioTracks()[0] ?? null;
  }

  /** Current tracks grouped by mesh slot, for new PeerConnections. */
  snapshot(): { mic: MediaStreamTrack | null; screen: MediaStreamTrack | null; systemAudio: MediaStreamTrack | null } {
    return { mic: this.micTrack, screen: this.screenTrack, systemAudio: this.systemAudioTrack };
  }

  get isScreenSharing(): boolean {
    const t = this.screenTrack;
    return !!t && t.readyState === 'live';
  }

  get isMicEnabled(): boolean {
    const t = this.micTrack;
    return !!t && t.enabled;
  }

  /** Acquire mic (always) and screen (default on). Throws on permission denial. */
  async start(opts: MediaStartOptions): Promise<void> {
    await this.startMic();
    await this.startScreen(opts.systemAudio);
  }

  /**
   * `navigator.mediaDevices` only exists in a secure context (HTTPS or
   * localhost). Over plain HTTP on a LAN IP — e.g. a phone hitting
   * http://192.168.x.x:5173 — it is undefined, so fail with an actionable
   * message instead of a cryptic "cannot read properties of undefined".
   */
  private assertMediaSupport(): void {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error(
        window.isSecureContext
          ? 'This browser does not support screen sharing / microphone capture.'
          : 'Camera/screen capture needs a secure connection. Open this page over HTTPS (or via localhost) — see the mobile/HTTPS note in the docs.',
      );
    }
  }

  async startMic(): Promise<void> {
    if (this.micTrack && this.micTrack.readyState === 'live') return;
    this.assertMediaSupport();
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false, // camera disabled entirely
    });
    this.syncOutbound();
  }

  /** Request a screen/window/tab. Optionally include system audio. */
  async startScreen(systemAudio: boolean): Promise<void> {
    this.assertMediaSupport();
    if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      throw new Error('Screen sharing is not available in this browser. iOS Safari cannot share a screen.');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: systemAudio,
    });
    this.screenStream = stream;

    const video = stream.getVideoTracks()[0];
    // Browser "Stop sharing" UI, tab close, or permission revoke ends the track.
    video?.addEventListener('ended', () => this.handleScreenEnded());

    this.syncOutbound();
    this.emit('tracks-changed', undefined);
  }

  stopScreen(): void {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.syncOutbound();
    this.emit('tracks-changed', undefined);
  }

  private handleScreenEnded(): void {
    this.screenStream = null;
    this.syncOutbound();
    this.emit('screen-ended', undefined);
    this.emit('tracks-changed', undefined);
  }

  /** Toggle mic mute. Returns the new enabled state. */
  toggleMic(): boolean {
    const t = this.micTrack;
    if (!t) return false;
    t.enabled = !t.enabled;
    return t.enabled;
  }

  setMicEnabled(enabled: boolean): void {
    const t = this.micTrack;
    if (t) t.enabled = enabled;
  }

  /** Recompute which tracks are on the outbound stream after any change. */
  private syncOutbound(): void {
    const desired = new Set<MediaStreamTrack>();
    if (this.micTrack) desired.add(this.micTrack);
    this.screenStream?.getTracks().forEach((t) => desired.add(t));

    for (const t of this.outbound.getTracks()) {
      if (!desired.has(t)) this.outbound.removeTrack(t);
    }
    for (const t of desired) {
      if (!this.outbound.getTracks().includes(t)) this.outbound.addTrack(t);
    }
  }

  /** Release everything. Called on leave / page unload. */
  dispose(): void {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.outbound.getTracks().forEach((t) => this.outbound.removeTrack(t));
    this.micStream = null;
    this.screenStream = null;
    this.clear();
  }
}
