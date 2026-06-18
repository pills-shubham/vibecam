import type { PublicConfig } from '@vibecam/types';

/** Server origin: same-origin in prod, proxied (empty) in dev. */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

const FALLBACK: PublicConfig = {
  stunUrls: ['stun:stun.l.google.com:19302'],
  heartbeatInterval: 30000,
  peerTimeout: 60000,
  maxRoomSize: 10,
  enableDebug: true,
};

/**
 * Fetch runtime config (ICE servers, intervals) from the backend. Falls back
 * to sane defaults so the app still loads if /config is briefly unavailable.
 */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  try {
    const res = await fetch(`${SERVER_URL}/config`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.json()) as PublicConfig;
  } catch (err) {
    console.warn('[config] using fallback config:', err);
    return FALLBACK;
  }
}

/** Build the RTCConfiguration used for every peer connection. */
export function buildRtcConfig(config: PublicConfig): RTCConfiguration {
  return {
    iceServers: [{ urls: config.stunUrls }],
    // Mesh: gather all candidates. No TURN by design (self-hosted/LAN focus).
    iceCandidatePoolSize: 2,
  };
}
