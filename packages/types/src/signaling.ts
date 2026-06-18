/**
 * WebRTC signaling payloads. The server relays these opaquely between peers;
 * it never parses SDP or ICE. Keeping them typed lets both ends agree on shape.
 */

export interface SdpPayload {
  /** Target peer id the message is routed to. */
  to: string;
  /** Source peer id (filled/validated by server). */
  from: string;
  description: RTCSessionDescriptionInitLike;
}

export interface IceCandidatePayload {
  to: string;
  from: string;
  candidate: RTCIceCandidateInitLike | null;
}

/**
 * Structural mirrors of the browser WebRTC dictionaries so the shared package
 * does not depend on DOM lib types (the server has no DOM).
 */
export interface RTCSessionDescriptionInitLike {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInitLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
