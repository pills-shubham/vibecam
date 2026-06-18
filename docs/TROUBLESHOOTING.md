# Troubleshooting

## "Permission denied" when joining
The browser blocked the mic or screen prompt. Click the address-bar
camera/screen icon and allow microphone + screen sharing, then rejoin. vibecam
shows a friendly toast and re-enables the Join button on denial.

## Screen share won't start / immediately stops
- You clicked **Cancel** in the OS picker (`AbortError`). Just press
  **Share screen** again.
- On macOS, grant the browser **Screen Recording** permission in
  *System Settings → Privacy & Security → Screen Recording*, then restart it.

## I can see myself but not other people's screens
- Confirm both peers actually pressed **Share screen** (a tile shows initials,
  not video, when a peer isn't sharing).
- Check the sidebar **connection quality** dot. "Disconnected/Poor" means ICE
  couldn't establish a direct path — common across the public internet behind
  symmetric NAT. vibecam ships **STUN only** (no TURN by design); use a LAN/VPN
  or add your own TURN if you need to traverse hard NATs.

## "Room is full"
`MAX_ROOM_SIZE` (default 10) was reached. Raise it in `.env` — but remember mesh
load grows with N²; beyond ~10 consider the SFU migration path in
[ARCHITECTURE.md](./ARCHITECTURE.md#sfu-migration-path).

## Audio echo
Use headphones. If a peer shares **system audio** while also unmuted near
speakers, that audio can loop. Mic capture uses echo cancellation, but system
audio + open speakers defeats it.

## A peer who closed their tab still shows briefly
Expected for a few seconds at most. A clean tab close fires `disconnect`
immediately; a hard crash is caught by the heartbeat sweep within
`PEER_TIMEOUT` (default 60s). Either way the peer is fully torn down — no ghosts.

## Reconnect loop / "Disconnected, reconnecting…"
The signaling socket dropped (server restart, network blip). Socket.IO retries
automatically; on reconnect vibecam **rejoins** and rebuilds the mesh. If it
never recovers, verify the server is up (`GET /health`) and that
`SOCKET_CORS_ORIGIN` matches the client origin.

## Nothing loads in production
Run `npm run build` **before** `npm start` — the server logs
`client bundle not found` if `apps/client/dist` is missing.

## `Cannot read properties of undefined (reading 'getUserMedia')` / mobile
`navigator.mediaDevices` only exists in a **secure context**. `http://localhost`
counts as secure, but a phone hitting `http://<your-ip>:5173` over plain HTTP
does **not** — so the object is undefined. Two fixes:

- **Run the dev server over HTTPS** (recommended for LAN/mobile):

  ```bash
  npm run dev:https
  ```

  The client is now served via self-signed TLS on `https://<your-ip>:5173`.
  On the phone, open that URL and accept the one-time certificate warning, then
  mic/screen capture works.
- **Or** use a tunnel that provides HTTPS (e.g. `cloudflared`, `ngrok`) and open
  the tunnel URL on the device.

Note: **iOS Safari cannot share a screen** at all (`getDisplayMedia` is
unsupported on iPhone). Mic + viewing others' shares still work; the app shows a
clear message if you try to start a screen share there.

## Verbose logs
Set `LOG_LEVEL=debug` in `.env` for server signaling traces; `ENABLE_DEBUG=true`
is forwarded to the client.
