# Deployment

vibecam is **fully self-hosted**. No Docker, nginx, TURN, cloud, or accounts are
required. It is a single Node process serving both the signaling websocket and
the static client.

## Local / LAN

```bash
npm install
npm run build      # builds server bundle + client static assets
npm start          # one process on PORT (default 3000)
```

Open `http://<host>:3000/room/<name>` on each device on the network. Because
WebRTC media is peer-to-peer, all participants must be able to reach each other
on the network (same LAN, or a VPN/overlay). STUN handles NAT for most home
setups; strict/symmetric NATs across the public internet may fail without TURN
(intentionally out of scope here).

## Single-origin production

In `npm start` (production), the Express server statically serves
`apps/client/dist` with SPA fallback, so deep links like `/room/x` work and the
browser talks to **one origin** — no CORS, no separate client host.

Set environment in `.env`:

```bash
NODE_ENV=production
PORT=3000
SOCKET_CORS_ORIGIN=*        # single-origin: CORS is effectively unused
MAX_ROOM_SIZE=10
LOG_LEVEL=info
```

## Running as a service (systemd example)

```ini
[Unit]
Description=vibecam
After=network.target

[Service]
WorkingDirectory=/opt/vibecam
ExecStart=/usr/bin/node apps/server/dist/index.js
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
User=vibecam

[Install]
WantedBy=multi-user.target
```

```bash
npm ci && npm run build
sudo cp -r . /opt/vibecam
sudo systemctl enable --now vibecam
```

## HTTPS note

Browsers require a **secure context** for `getUserMedia`/`getDisplayMedia`.
`http://localhost` is treated as secure, so local dev works as-is. For other
hosts, terminate TLS in front of the process (a reverse proxy or Node's `https`
server) — that is the only situation where you might add a proxy, and it is
optional for `localhost`/LAN testing.

## Health & metrics

- `GET /health` → `{ status, uptimeSeconds, timestamp }`
- `GET /metrics` → rooms, peers, quality breakdown, memory
- `GET /config` → public client config (STUN, intervals, limits)

Point any uptime checker at `/health`.
