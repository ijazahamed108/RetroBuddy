import { getSystem } from './systems.js';
import { findGame } from './catalog.js';
import { CustomRoms, Recents } from './storage.js';
import { $, $$, ICONS } from './util.js';
import { registerServiceWorker } from './pwa.js';

export const EMULATORJS_VERSION = '4.2.3';
const EMULATORJS_DATA = `https://cdn.emulatorjs.org/${EMULATORJS_VERSION}/data/`;
const LOADER_TIMEOUT_MS = 30000;

function showMessage(title, text) {
  $('#stage-message-title').textContent = title;
  $('#stage-message-text').textContent = text;
  $('#stage-message').hidden = false;
  $('#play-title').textContent = title;
}

async function resolveTarget(params) {
  const gameId = params.get('game');
  const romId = params.get('rom');

  if (gameId) {
    const game = await findGame(gameId);
    if (!game) return { error: ['Game not found', `There is no game called “${gameId}” in the library.`] };
    return {
      kind: 'catalog',
      id: game.id,
      title: game.title,
      system: game.system,
      gameUrl: new URL(game.file, location.href).href,
      notes: game.description,
    };
  }

  if (romId) {
    let rom;
    try {
      rom = await CustomRoms.get(romId);
    } catch (err) {
      return { error: ['Storage unavailable', err.message || 'This browser blocked access to local storage.'] };
    }
    if (!rom) return { error: ['ROM not found', 'This ROM is no longer stored in this browser. Add it again from the library.'] };
    if (!getSystem(rom.system)) return { error: ['Unknown system', `“${rom.name}” is set to an unsupported system.`] };
    const file = rom.blob instanceof File ? rom.blob : new File([rom.blob], rom.name);
    return {
      kind: 'custom',
      id: rom.id,
      title: rom.name.replace(/\.[^.]+$/, ''),
      system: rom.system,
      gameUrl: file,
      notes: 'Your own ROM, loaded from this browser’s storage.',
    };
  }

  return { error: ['Nothing to play', 'Pick a game from the library to start playing.'] };
}

function configureEmulator(target) {
  const sys = getSystem(target.system);
  Object.assign(window, {
    EJS_player: '#game',
    EJS_core: sys.core,
    EJS_gameUrl: target.gameUrl,
    EJS_gameName: target.title,
    EJS_pathtodata: EMULATORJS_DATA,
    EJS_color: '#ff3e8a',
    EJS_backgroundColor: '#000000',
    EJS_startOnLoaded: false,
    EJS_language: 'en-US',
    EJS_disableAutoLang: false,
    EJS_threads: false,
    EJS_Buttons: { netplay: false, exitEmulation: false },
    EJS_onGameStart: () => onGameStart(target),
  });
}

function onGameStart(target) {
  Recents.record(target.kind, target.id);
  if (target.kind === 'custom') {
    CustomRoms.update(target.id, { lastPlayed: Date.now() }).catch(() => {});
  }
}

function loadEmulator() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${EMULATORJS_DATA}loader.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not download the emulator. Check your internet connection and reload.'));
    document.body.appendChild(script);
  });
}

function watchForStartup() {
  const timer = setTimeout(() => {
    if (!window.EJS_emulator) {
      showMessage('Emulator did not start', 'The emulator is taking too long to load. Check your connection and reload the page.');
    }
  }, LOADER_TIMEOUT_MS);
  const check = setInterval(() => {
    if (window.EJS_emulator) { clearTimeout(timer); clearInterval(check); }
  }, 500);
}

function flushSaves() {
  try {
    const emu = window.EJS_emulator;
    if (emu?.started && emu.gameManager) emu.gameManager.saveSaveFiles();
  } catch (err) {
    console.warn('Could not flush save data', err);
  }
}

function setupChrome(target) {
  const dlg = $('#help-dialog');
  $$('[data-close]:empty', dlg).forEach((b) => { b.innerHTML = ICONS.close; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
  $('#help-btn').addEventListener('click', () => dlg.showModal());
  if (target?.notes) $('#help-game-notes').textContent = target.notes;

  // Prefer real history navigation so the library keeps its scroll position.
  $('#back-btn').addEventListener('click', (e) => {
    flushSaves();
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves(); });
  window.addEventListener('pagehide', flushSaves);
}

async function init() {
  registerServiceWorker();
  const target = await resolveTarget(new URLSearchParams(location.search));
  setupChrome(target);

  if (target.error) {
    showMessage(...target.error);
    return;
  }

  const sys = getSystem(target.system);
  document.title = `${target.title} — RetroBuddy`;
  $('#play-title').textContent = target.title;
  const badge = $('#play-badge');
  badge.textContent = sys.short;
  badge.style.setProperty('--sys-color', sys.color);
  badge.hidden = false;

  configureEmulator(target);
  watchForStartup();
  try {
    await loadEmulator();
  } catch (err) {
    showMessage('Offline', err.message);
  }
}

init();
