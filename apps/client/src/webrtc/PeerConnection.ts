import type {
  IceCandidatePayload,
  SdpPayload,
  RTCSessionDescriptionInitLike,
} from '@vibecam/types';
import { Emitter } from '../util/Emitter.js';

type PeerEvents = {
  signal: { kind: 'offer' | 'answer'; description: RTCSessionDescriptionInitLike };
  ice: RTCIceCandidateInit | null;
  stream: MediaStream;
  state: RTCPeerConnectionState;
};

/** The three fixed media slots every peer publishes (track may be null). */
export type MediaSlot = 'mic' | 'screen' | 'systemAudio';

export interface LocalMediaTracks {
  mic: MediaStreamTrack | null;
  screen: MediaStreamTrack | null;
  systemAudio: MediaStreamTrack | null;
}

/**
 * One WebRTC link to a single remote peer, implementing the **Perfect
 * Negotiation** pattern (per the WebRTC spec / MDN). Each side is assigned a
 * stable `polite` role; glare is resolved by the impolite peer ignoring an
 * incoming offer while it is mid-offer, and the polite peer rolling back.
 *
 * Also performs ICE restart on `failed` for connection recovery.
 */
export class PeerConnection extends Emitter<PeerEvents> {
  readonly pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private readonly remoteStream = new MediaStream();
  private closed = false;
  /** ICE candidates that arrived before the remote description was applied. */
  private readonly pendingCandidates: RTCIceCandidateInit[] = [];
  /** Stable senders, one per media slot, so replaceTrack never has to search. */
  private readonly senders = new Map<MediaSlot, RTCRtpSender>();

  constructor(
    readonly peerId: string,
    private readonly polite: boolean,
    rtcConfig: RTCConfiguration,
    tracks: LocalMediaTracks,
  ) {
    super();
    this.pc = new RTCPeerConnection(rtcConfig);
    // Wire handlers BEFORE creating transceivers so the negotiationneeded they
    // schedule is guaranteed to be observed.
    this.wireEvents();
    this.setupTransceivers(tracks);
  }

  /**
   * Publish local tracks with plain addTrack. Critically, this lets the browser
   * pair the ANSWERER's tracks into its answer automatically — pre-created
   * transceivers do not associate on the answering side and leave it recvonly
   * (the answerer-never-sends bug). Senders are kept per slot so screen-share
   * toggling is a replaceTrack (screen is on at join, so its sender persists).
   */
  private setupTransceivers(tracks: LocalMediaTracks): void {
    if (tracks.mic) this.senders.set('mic', this.pc.addTrack(tracks.mic));
    if (tracks.screen) this.senders.set('screen', this.pc.addTrack(tracks.screen));
    if (tracks.systemAudio) this.senders.set('systemAudio', this.pc.addTrack(tracks.systemAudio));
  }

  private wireEvents(): void {
    this.pc.onnegotiationneeded = async () => {
      // Deterministic initiator: only the IMPOLITE peer creates the offer; the
      // polite peer waits and answers in a stable state. Because the transceiver
      // layout is fixed and media changes go through replaceTrack (no new
      // m-lines), this initial negotiation is the *only* one ever needed — so
      // gating it here removes glare completely and avoids the fragile
      // polite-side rollback that was dropping the polite peer's outbound media.
      if (this.polite) return;
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        const desc = this.pc.localDescription;
        if (desc) this.emit('signal', { kind: 'offer', description: desc });
      } catch (err) {
        console.error(`[peer ${this.peerId}] negotiation error`, err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.onicecandidate = ({ candidate }) => {
      this.emit('ice', candidate ? candidate.toJSON() : null);
    };

    this.pc.ontrack = ({ track, streams }) => {
      // Prefer the stream the sender grouped tracks into; fall back to our own.
      const src = streams[0];
      if (src) {
        src.getTracks().forEach((t) => this.addRemoteTrack(t));
      } else {
        this.addRemoteTrack(track);
      }
      this.emit('stream', this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      this.emit('state', this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'failed') {
        console.warn(`[peer ${this.peerId}] ICE failed — restarting`);
        this.restartIce();
      }
    };
  }

  private addRemoteTrack(track: MediaStreamTrack): void {
    if (!this.remoteStream.getTracks().includes(track)) {
      this.remoteStream.addTrack(track);
      track.addEventListener('ended', () => {
        try {
          this.remoteStream.removeTrack(track);
        } catch {
          /* noop */
        }
        this.emit('stream', this.remoteStream);
      });
    }
  }

  /** Handle an inbound offer/answer with glare resolution. */
  async onRemoteDescription(payload: SdpPayload): Promise<void> {
    if (this.closed) return;
    const description = payload.description;
    const isOffer = description.type === 'offer';
    const readyForOffer =
      !this.makingOffer && (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
    const offerCollision = isOffer && !readyForOffer;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    try {
      this.isSettingRemoteAnswerPending = description.type === 'answer';
      await this.pc.setRemoteDescription(description as RTCSessionDescriptionInit);
      this.isSettingRemoteAnswerPending = false;

      // Remote description now exists — apply any candidates that raced ahead.
      await this.flushPendingCandidates();

      if (isOffer) {
        await this.pc.setLocalDescription();
        const desc = this.pc.localDescription;
        if (desc) this.emit('signal', { kind: 'answer', description: desc });
      }
    } catch (err) {
      console.error(`[peer ${this.peerId}] setRemoteDescription failed`, err);
    }
  }

  async onRemoteIce(payload: IceCandidatePayload): Promise<void> {
    if (this.closed || !payload.candidate) return;
    const candidate = payload.candidate as RTCIceCandidateInit;
    // Adding a candidate before setRemoteDescription throws and the candidate is
    // lost — the #1 cause of one-way media. Buffer until the description lands.
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) console.warn(`[peer ${this.peerId}] addIceCandidate failed`, err);
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    if (this.pendingCandidates.length === 0) return;
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (err) {
        if (!this.ignoreOffer) console.warn(`[peer ${this.peerId}] flush candidate failed`, err);
      }
    }
  }

  /** Renegotiate with an ICE restart to recover a broken path. */
  async restartIce(): Promise<void> {
    if (this.closed) return;
    try {
      const restartIce = (this.pc as { restartIce?: () => void }).restartIce;
      if (restartIce) {
        // Preferred path: triggers onnegotiationneeded with fresh ICE creds.
        restartIce.call(this.pc);
      } else {
        // Fallback for older engines without restartIce().
        await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: true }));
        const desc = this.pc.localDescription;
        if (desc) this.emit('signal', { kind: 'offer', description: desc });
      }
    } catch (err) {
      console.error(`[peer ${this.peerId}] ICE restart failed`, err);
    }
  }

  /**
   * Swap the outgoing track for a fixed slot (e.g. start/stop screen share)
   * without renegotiating. Uses the pinned sender, so it works even when the
   * current track is null — fixing the "can't re-share after stopping" bug.
   */
  async replaceTrack(slot: MediaSlot, track: MediaStreamTrack | null): Promise<void> {
    const sender = this.senders.get(slot);
    if (sender) await sender.replaceTrack(track);
  }

  getSenders(): RTCRtpSender[] {
    return this.pc.getSenders();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.remoteStream.getTracks().forEach((t) => this.remoteStream.removeTrack(t));
    this.pc.close();
    this.clear();
  }
}
