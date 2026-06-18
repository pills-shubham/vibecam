# Architecture

vibecam is a **mesh** WebRTC app: every participant holds a direct
`RTCPeerConnection` to every other participant. A small Express + Socket.IO
server does **signaling only** — it relays SDP/ICE and tracks room membership.
It never sees or proxies media.

```
            ┌──────────────────────────── Browser (peer) ────────────────────────────┐
            │  UI (RoomView)                                                           │
            │   ├─ Stage / Tiles / Sidebar / Controls                                  │
            │   └─ RoomStore  ◄── granular events                                      │
            │  RoomController (composition root)                                       │
            │   ├─ MediaManager     (mic + screen, camera OFF)                         │
            │   ├─ MeshManager ──┬─ PeerConnection (Perfect Negotiation) × N           │
            │   │                └─ ConnectionMonitor (RTCStats → quality)             │
            │   ├─ VoiceActivityDetector (Web Audio)                                   │
            │   └─ SocketClient (Socket.IO)                                            │
            └───────────────────────────────┬─────────────────────────────────────────┘
                                             │  SDP / ICE / state events (relayed)
            ┌────────────────────────────────▼────────────────────────────────────────┐
            │ Server                                                                    │
            │  SocketService ── orchestrates per-connection handlers                    │
            │   ├─ RoomService          (in-memory rooms + peers, authoritative)        │
            │   ├─ PeerService          (heartbeat liveness sweeping)                    │
            │   ├─ SignalingService     (relay offer/answer/ice, validate routing)       │
            │   ├─ ConnectionStateService (aggregate reported link quality)              │
            │   └─ HealthService        (/health, /metrics)                              │
            │  ConfigService (env) · LoggerService (scoped, leveled)                     │
            └───────────────────────────────────────────────────────────────────────────┘
```

## Why mesh

For 2–10 peers a full mesh is simplest and needs no media server. Each peer
encodes once per remote peer; at 10 peers that is 9 outbound streams — fine on
modern hardware for screen content. Beyond ~10, an SFU is the right move (below).

## Module responsibilities

### Server (`apps/server`)
- **RoomService** — the only authoritative state. Rooms and peers in memory;
  creates/destroys rooms on demand, enforces capacity, tracks presenter. Pure
  data, no socket knowledge → unit-testable and storage-swappable.
- **PeerService** — liveness. Clients heartbeat; a periodic sweep removes peers
  that went silent (crashed tab) through the *same* teardown path as a clean
  disconnect. This is the no-ghost-peer guarantee.
- **SignalingService** — relays `offer`/`answer`/`ice-candidate` to the targeted
  peer after validating both share a room. Opaque to SDP.
- **ConnectionStateService** — stores the quality/state each peer reports for
  `/metrics`.
- **SocketService** — wires Socket.IO events to the services; owns join/leave.
- **HealthService**, **ConfigService**, **LoggerService** — ops/config/logging.

### Client (`apps/client`)
- **RoomController** — composition root; owns lifecycle and teardown.
- **MediaManager** — acquires mic + screen, exposes one outbound stream, detects
  share-stopped/tab-closed/permission-revoked, never requests camera.
- **MeshManager / PeerConnection** — the mesh and Perfect Negotiation.
- **ConnectionMonitor** — RTCStats → quality buckets.
- **VoiceActivityDetector** — Web Audio RMS → speaking flags.
- **RoomStore** — view-model state; emits `added/removed/updated/layout` so UI
  components patch surgically instead of re-rendering.

### Shared packages
- **types** — the single source of truth for socket events, models, config.
- **shared** — logger, validation, constants, id generation (isomorphic).
- **config** — environment loading + public-config projection.

## State ownership

The **server** owns membership truth; the **client store** owns view-model
truth. They sync via events, never share mutable objects. Camera state is forced
off and client booleans are re-coerced server-side — clients are never trusted
verbatim.

## SFU migration path

Two seams make an SFU swap local:

1. **Client:** `MeshManager` exposes `add/remove/handle*` + `replaceVideoTrack`.
   Replace it with an `SfuManager` that holds a single up/down connection to the
   media server; `RoomController`, `RoomStore`, and all UI stay unchanged.
2. **Server:** `SignalingService` is the only component that assumes peer-to-peer
   relay. An SFU build replaces it with a service that terminates
   PeerConnections server-side. `SocketService` and `RoomService` are reused.

The shared event contract already carries `to`/`from` routing that maps cleanly
onto an SFU's publish/subscribe model.
