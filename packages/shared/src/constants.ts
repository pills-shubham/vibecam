/** Cross-cutting constants used by both client and server. */

export const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const DISPLAY_NAME_MAX = 32;
export const DISPLAY_NAME_MIN = 1;

/** Quality thresholds derived from RTCStats (packet loss %, RTT ms). */
export const QUALITY_THRESHOLDS = {
  excellent: { maxLoss: 0.02, maxRtt: 150 },
  good: { maxLoss: 0.05, maxRtt: 300 },
  poor: { maxLoss: 0.15, maxRtt: 600 },
} as const;

/** Voice activity detection tuning. */
export const VAD = {
  /** RMS above this (0..1) counts as speaking. */
  speakingThreshold: 0.04,
  /** Smoothing for the analyser. */
  smoothing: 0.8,
  fftSize: 512,
  /** ms of silence before clearing the speaking flag. */
  silenceHoldMs: 400,
} as const;
