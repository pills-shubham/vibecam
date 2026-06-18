// Headless mesh monitor: launches N isolated Brave peers with fake mic+screen,
// joins them into one room, then reports the received-media matrix so we can see
// objectively which peer receives whom (audio + video frames).
//
// Usage: node scripts/monitor-mesh.mjs [roomUrl] [peerCount]
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRAVE = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const ROOM_URL = process.argv[2] ?? 'http://localhost:3000/room/monitortest';
const COUNT = Number(process.argv[3] ?? 3);

const FAKE_MEDIA_ARGS = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--auto-select-desktop-capture-source=Entire screen',
  '--auto-accept-this-tab-capture',
  '--enable-usermedia-screen-capturing',
  '--allow-http-screen-capture',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchPeer(index) {
  const userDataDir = mkdtempSync(join(tmpdir(), `vibecam-peer${index}-`));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: BRAVE,
    headless: false,
    args: FAKE_MEDIA_ARGS,
    ignoreDefaultArgs: ['--mute-audio'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const logs = [];
  page.on('console', (m) => logs.push(`[u${index}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[u${index}] PAGEERROR: ${e.message}`));
  await page.goto(ROOM_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#displayName', `user${index}`);
  await page.click('.btn--primary');
  return { ctx, page, index, logs };
}

// Runs inside each page: enumerate remote tiles and inspect their media.
function inspectInPage() {
  const tiles = [...document.querySelectorAll('.tile[data-peer]')];
  return tiles.map((tile) => {
    const video = tile.querySelector('video');
    const stream = video && video.srcObject ? video.srcObject : null;
    const tracks = stream ? stream.getTracks().map((t) => `${t.kind}:${t.readyState}:${t.muted ? 'muted' : 'live'}`) : [];
    return {
      peer: tile.getAttribute('data-peer'),
      isSelf: !!(video && video.muted),
      name: (tile.querySelector('.tile__name')?.textContent ?? '').trim(),
      tracks,
      videoW: video?.videoWidth ?? 0,
      videoH: video?.videoHeight ?? 0,
      paused: video?.paused ?? true,
    };
  });
}

async function main() {
  console.log(`Launching ${COUNT} peers into ${ROOM_URL}\n`);
  const peers = [];
  for (let i = 0; i < COUNT; i++) {
    peers.push(await launchPeer(i));
    await sleep(2500); // stagger joins like real users
  }

  console.log('Waiting 12s for ICE + media to settle...\n');
  await sleep(12000);

  for (const p of peers) {
    let report;
    try {
      report = await p.page.evaluate(inspectInPage);
    } catch (e) {
      report = `evaluate failed: ${e.message}`;
    }
    console.log(`================ user${p.index} sees ================`);
    if (Array.isArray(report)) {
      for (const t of report) {
        const tag = t.isSelf ? '(self)' : '(remote)';
        const frames = t.videoW > 0 ? `${t.videoW}x${t.videoH}` : 'NO-FRAMES';
        console.log(`  ${tag} ${t.name.padEnd(14)} tracks=[${t.tracks.join(', ')}] video=${frames} paused=${t.paused}`);
      }
    } else {
      console.log('  ', report);
    }
    console.log('');
  }

  console.log('================ console errors/warnings ================');
  for (const p of peers) {
    const interesting = p.logs.filter((l) => /error|fail|warn|peer /i.test(l));
    interesting.slice(-12).forEach((l) => console.log(l));
  }

  console.log('\nLeaving browsers open 8s for visual check, then closing...');
  await sleep(8000);
  for (const p of peers) await p.ctx.close().catch(() => {});
}

main().catch((e) => {
  console.error('monitor failed:', e);
  process.exit(1);
});
