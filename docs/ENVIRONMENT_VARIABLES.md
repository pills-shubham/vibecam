# Environment Variables

All configuration lives in `.env` (copy from `.env.example`). Every value has a
safe default, so the app runs with no `.env` at all.

| Variable | Default | Scope | Description |
| --- | --- | --- | --- |
| `PORT` | `3000` | server | HTTP + Socket.IO listen port. |
| `NODE_ENV` | `development` | server | `development` \| `production` \| `test`. In production the server also serves the built client. |
| `CLIENT_URL` | `http://localhost:5173` | server | Where the dev client runs (logged for convenience). |
| `SOCKET_CORS_ORIGIN` | `http://localhost:5173` | server | Allowed CORS origin(s) for HTTP + Socket.IO. Comma-separate multiple; `*` allows all. |
| `STUN_URL` | `stun:stun.l.google.com:19302` | both | Comma-separated STUN URLs. Exposed to the browser via `GET /config`. No TURN by design. |
| `HEARTBEAT_INTERVAL` | `30000` | both | Client heartbeat period (ms). Also caps the Socket.IO ping interval. |
| `PEER_TIMEOUT` | `60000` | server | Idle time (ms) after which a peer with no heartbeat is swept as dead. |
| `MAX_ROOM_SIZE` | `10` | both | Hard cap on participants per room (mesh sweet-spot ≤ 10). |
| `ENABLE_DEBUG` | `true` | both | Surfaced to the client for verbose diagnostics. |
| `LOG_LEVEL` | `info` | server | `debug` \| `info` \| `warn` \| `error`. |

## Exposure boundary

The browser only receives the **public** subset via `GET /config`:
`stunUrls`, `heartbeatInterval`, `peerTimeout`, `maxRoomSize`, `enableDebug`.
Everything else stays server-side (see `packages/config` → `toPublicConfig`).

## Client build-time override

`VITE_SERVER_URL` (optional) points the client at a non-same-origin signaling
server. Leave empty for the default (dev proxy / same-origin in production).
