import { VAD } from '@vibecam/shared';

type SpeakingCallback = (peerId: string, speaking: boolean) => void;

interface Analysed {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array;
  speaking: boolean;
  lastVoiceAt: number;
}

/**
 * Web Audio API voice-activity detection. One shared AudioContext drives an
 * analyser per audio stream (local + each remote). Computes RMS each animation
 * frame and flips a per-peer speaking flag with a short silence hold to avoid
 * flicker. Used purely for the speaking border/indicator — no signaling.
 */
export class VoiceActivityDetector {
  private ctx: AudioContext | null = null;
  private readonly peers = new Map<string, Analysed>();
  private raf: number | null = null;

  constructor(private readonly onChange: SpeakingCallback) {}

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Begin analysing a peer's audio. Safe to call again to replace the stream. */
  track(peerId: string, stream: MediaStream): void {
    const audio = stream.getAudioTracks();
    if (audio.length === 0) {
      this.untrack(peerId);
      return;
    }
    this.untrack(peerId);
    const ctx = this.ensureCtx();
    const source = ctx.createMediaStreamSource(new MediaStream(audio));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = VAD.fftSize;
    analyser.smoothingTimeConstant = VAD.smoothing;
    source.connect(analyser);
    this.peers.set(peerId, {
      ctx,
      source,
      analyser,
      data: new Uint8Array(analyser.fftSize),
      speaking: false,
      lastVoiceAt: 0,
    });
    if (this.raf === null) this.loop();
  }

  untrack(peerId: string): void {
    const a = this.peers.get(peerId);
    if (!a) return;
    try {
      a.source.disconnect();
      a.analyser.disconnect();
    } catch {
      /* already torn down */
    }
    if (a.speaking) this.onChange(peerId, false);
    this.peers.delete(peerId);
  }

  private loop = (): void => {
    const now = performance.now();
    for (const [peerId, a] of this.peers) {
      a.analyser.getByteTimeDomainData(a.data as Parameters<AnalyserNode['getByteTimeDomainData']>[0]);
      let sum = 0;
      for (let i = 0; i < a.data.length; i++) {
        const v = (a.data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / a.data.length);
      if (rms > VAD.speakingThreshold) a.lastVoiceAt = now;
      const speaking = now - a.lastVoiceAt < VAD.silenceHoldMs;
      if (speaking !== a.speaking) {
        a.speaking = speaking;
        this.onChange(peerId, speaking);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const peerId of [...this.peers.keys()]) this.untrack(peerId);
    void this.ctx?.close();
    this.ctx = null;
  }
}
