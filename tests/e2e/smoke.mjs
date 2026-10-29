#!/usr/bin/env node
/**
 * End-to-end smoke test in a real (headless) Chrome.
 *
 *   npm install            # installs puppeteer-core (dev dependency)
 *   npm run test:e2e       # boots a local server and runs the checks
 *
 * Env vars:
 *   CHROME_PATH   path to Chrome/Chromium (auto-detected on macOS/Linux/Windows)
 *   ALL_GAMES=1   boot every bundled game instead of one per system
 *   SHOTS=dir     where to write screenshots (default: tests/e2e/screenshots)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.resolve(process.env.SHOTS || path.join(ROOT, 'tests', 'e2e', 'screenshots'));
const PORT = 8765 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}/RetroBuddy/`;

let puppeteer;
try {
  puppeteer = await import('puppeteer-core');
} catch {
  console.error('puppeteer-core is not installed. Run `npm install` first.');
  process.exit(2);
}
const { KnownDevices } = puppeteer;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  }[process.platform] || [];
  return candidates.find((p) => fs.existsSync(p));
}

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to your Chrome/Chromium executable.');
  process.exit(2);
}

fs.mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs'), '--port', String(PORT), '--base', '/RetroBuddy/'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-first-run'],
});

const results = [];
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '✔' : '✖'} ${name}${detail ? `  (${detail})` : ''}`);
};
function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) problems.push(`[${label}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${label}] ${e.message}`));
}

async function boot(page, url, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ejs_start_button', { timeout: 60000 });
  await page.click('.ejs_start_button');
  const started = await page.waitForFunction(() => window.EJS_emulator?.started === true, { timeout: 90000, polling: 500 })
    .then(() => true, () => false);
  await sleep(2500);
  const core = await page.evaluate(() => window.EJS_emulator?.getCore?.());
  await page.screenshot({ path: path.join(SHOTS, `play-${label}.png`) });
  check(`boots ${label}`, started, core);
}

try {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', 'games.json'), 'utf8')).games;
  const page = await browser.newPage();
  watch(page, 'library');
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });

  check('library renders every game', (await page.$$eval('#grid .card', (c) => c.length)) === catalog.length);
  const broken = await page.$$eval('#grid img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length);
  check('all cover images load', broken === 0, `${broken} broken`);
  await page.screenshot({ path: path.join(SHOTS, 'library-desktop.png') });

  await page.type('#search', 'zzzz-no-match');
  await sleep(300);
  check('search empty state', await page.$eval('#grid-empty', (e) => !e.hidden));
  await page.$eval('#search', (i) => { i.value = ''; i.dispatchEvent(new Event('input')); });
  await sleep(300);

  const firstSystem = catalog[0].system;
  await page.click(`[data-filter="${firstSystem}"]`);
  const expected = catalog.filter((g) => g.system === firstSystem).length;
  check(`system filter (${firstSystem})`, (await page.$$eval('#grid .card', (c) => c.length)) === expected);
  await page.click('[data-filter="all"]');

  await page.click(`[data-info="${catalog[0].id}"]`);
  check('game info dialog', !!(await page.waitForSelector('#game-dialog[open]', { timeout: 3000 }).catch(() => null)));
  await page.keyboard.press('Escape');

  const play = await browser.newPage();
  watch(play, 'player');
  await play.setViewport({ width: 1280, height: 800 });
  const perSystem = new Map();
  catalog.forEach((g) => { if (!perSystem.has(g.system)) perSystem.set(g.system, g); });
  const toBoot = process.env.ALL_GAMES ? catalog : [...perSystem.values()];
  for (const g of toBoot) await boot(play, `${BASE}play.html?game=${g.id}`, g.id);

  await play.goto(`${BASE}play.html?game=does-not-exist`, { waitUntil: 'networkidle0' });
  check('unknown game shows error', await play.$eval('#stage-message', (e) => !e.hidden));
  await play.close();

  // Custom ROM: upload a copy of a bundled ROM under a new name.
  await page.bringToFront();
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const sample = catalog.find((g) => g.system === 'gb') || catalog[0];
  const tmpRom = path.join(os.tmpdir(), `retrobuddy-custom-${Date.now()}${path.extname(sample.file)}`);
  fs.copyFileSync(path.join(ROOT, sample.file), tmpRom);
  const input = await page.$('#rom-input');
  await Promise.all([page.waitForNavigation({ timeout: 30000 }), input.uploadFile(tmpRom)]);
  check('custom ROM opens player', page.url().includes('play.html?rom='));
  await page.waitForSelector('.ejs_start_button', { timeout: 60000 });
  await page.click('.ejs_start_button');
  check('custom ROM boots', await page.waitForFunction(() => window.EJS_emulator?.started === true, { timeout: 90000 }).then(() => true, () => false));
  fs.rmSync(tmpRom, { force: true });

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const ambiguous = path.join(os.tmpdir(), `retrobuddy-mystery-${Date.now()}.bin`);
  fs.writeFileSync(ambiguous, Buffer.alloc(1024));
  await (await page.$('#rom-input')).uploadFile(ambiguous);
  check('ambiguous file asks for system', !!(await page.waitForSelector('#system-dialog[open]', { timeout: 5000 }).catch(() => null)));
  await page.keyboard.press('Escape');
  fs.rmSync(ambiguous, { force: true });

  await page.reload({ waitUntil: 'networkidle0' });
  check('My ROMs persists after reload', (await page.$$eval('#rom-list .rom-item', (l) => l.length)) >= 1);
  check('Continue playing row', (await page.$$eval('#recents .card', (l) => l.length)) >= 1);
  check('service worker active', await page.evaluate(() => !!navigator.serviceWorker.controller));
  await page.screenshot({ path: path.join(SHOTS, 'library-with-recents.png') });

  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grid .card', { timeout: 10000 }).catch(() => {});
  check('library works offline', (await page.$$eval('#grid .card', (c) => c.length)) === catalog.length);
  await page.setOfflineMode(false);
  await page.close();

  const mobile = await browser.newPage();
  watch(mobile, 'mobile');
  await mobile.emulate(KnownDevices['iPhone 13']);
  await mobile.goto(BASE, { waitUntil: 'networkidle0' });
  check('mobile: no horizontal scroll', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobile.screenshot({ path: path.join(SHOTS, 'library-mobile.png') });
  await mobile.goto(`${BASE}play.html?game=${catalog[0].id}`, { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('.ejs_start_button', { timeout: 60000 });
  await mobile.tap('.ejs_start_button');
  check('mobile: game boots', await mobile.waitForFunction(() => window.EJS_emulator?.started === true, { timeout: 90000 }).then(() => true, () => false));
  await sleep(2000);
  check('mobile: virtual gamepad shown', await mobile.evaluate(() => {
    const v = document.querySelector('.ejs_virtualGamepad_parent');
    return !!v && getComputedStyle(v).display !== 'none';
  }));
  await mobile.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 2 });
  await sleep(1200);
  await mobile.screenshot({ path: path.join(SHOTS, 'play-mobile-landscape.png') });
} catch (err) {
  check('test run completed', false, err.message);
} finally {
  await browser.close();
  server.kill();
}

const unique = [...new Set(problems)];
check('no console / CSP errors', unique.length === 0, unique.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${path.relative(process.cwd(), SHOTS)}`);
process.exit(failed ? 1 : 0);
