# [CLIENT NAME PLACEHOLDER] Kiosk Support (vibecam)

A **self-hosted, screen-sharing-first** WebRTC collaboration platform tailored for remote kiosk and POS support across hospitality venues (restaurants, hotels, cafés). No Docker,
no nginx, no TURN provider, no cloud, no accounts, no room codes. Open a URL,
pick a screen, join.

> Screen sharing is the product — **the camera is never used**. Designed to allow back-office staff to instantly see a guest's kiosk screen. Microphone and
> screen share are on by default.

> [!IMPORTANT]
> **Client Content Missing:** Please provide the real [CLIENT NAME] and any specific branding/venue details so placeholders can be updated.

- **Architecture:** WebRTC **mesh** (direct peer-to-peer), tuned for **2–10**
  participants.
- **Stack:** Vite + TypeScript (client), Express + Socket.IO + TypeScript
  (server), strict TS throughout, **zero `.js` source files**.
- **Run it with two commands.**

```bash
npm install
npm run dev      # client on :5173, server on :3000
```

Production:

```bash
npm run build
npm start        # serves the built client + signaling on :3000
```

Then open <http://localhost:5173/room/my-room> (dev) or
<http://localhost:3000/room/my-room> (prod) in two browser tabs/devices.

---

## Features

| Area | What you get |
| --- | --- |
| Media | Mic on by default · screen/window/tab share · optional **system audio** checkbox · camera fully disabled |
| Mesh | Perfect Negotiation, ICE restart, renegotiation, stream replacement, automatic peer cleanup |
| Resilience | Handles refresh, tab close, disconnect, reconnect, network drops — **no ghost peers, no leaks** |
| UI | Dark theme · top bar · stage · participant sidebar · bottom controls · focus & fullscreen · presenter mode · raise hand |
| Signals | Active-speaker (Web Audio VAD) · connection quality (RTCStats) · live status badges |
| Shortcuts | `M` mute · `S` share · `F` focus · `P` participants · `C` copy link · `Esc` exit fullscreen |

## Monorepo layout

```
apps/
  client/     Vite + TS front-end (UI, media, WebRTC mesh)
  server/     Express + Socket.IO signaling server
packages/
  types/      Shared event/model/config contracts
  shared/     Logger, validation, constants, ids (isomorphic)
  config/     Environment loading (ConfigService)
docs/         Architecture, deployment, WebRTC flow, troubleshooting, env, diagrams
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run client + server with hot reload |
| `npm run build` | Build server bundle and client static assets |
| `npm start` | Serve the built app (single origin on `:3000`) |
| `npm run typecheck` | Strict project-wide type check |
| `npm run lint` | ESLint over all TypeScript |
| `npm test` | Vitest unit + integration suite |

## How it works (60 seconds)

1. Browser loads `/room/:id`, asks for a display name + system-audio option.
2. On **Join**, the browser prompts for a screen/window/tab and grants the mic.
3. The client opens a Socket.IO connection and emits `join-room`.
4. The server places the peer in an in-memory room and tells everyone else.
5. Each pair of peers negotiates a direct `RTCPeerConnection` (mesh) using the
   **Perfect Negotiation** pattern. The server only relays SDP/ICE — it never
   touches media.
6. Voice activity, connection quality, presenter, focus, and raise-hand are
   layered on top via lightweight signaling events.

See [`docs/`](./docs) for the deep dive and Mermaid diagrams.

## Migrating to an SFU later

The mesh is isolated behind `MeshManager` (client) and `SignalingService`
(server). Both expose narrow interfaces so an `SfuManager` / media-server
signaling layer can replace them without touching the UI or room lifecycle. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#sfu-migration-path).

## License

MIT — self-host freely.
