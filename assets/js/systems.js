/**
 * Supported systems and the EmulatorJS core that runs each one.
 * `core` values must match the system keys understood by EmulatorJS
 * (see EmulatorJS `getCores()`).
 */
export const SYSTEMS = Object.freeze({
  nes: { core: 'nes', name: 'NES / Famicom', short: 'NES', maker: 'Nintendo', color: '#e4002b', extensions: ['nes', 'fds', 'unf', 'unif'] },
  snes: { core: 'snes', name: 'Super Nintendo', short: 'SNES', maker: 'Nintendo', color: '#7b5aa6', extensions: ['sfc', 'smc', 'fig', 'swc', 'bs'] },
  gb: { core: 'gb', name: 'Game Boy', short: 'GB', maker: 'Nintendo', color: '#8bac0f', extensions: ['gb'] },
  gbc: { core: 'gb', name: 'Game Boy Color', short: 'GBC', maker: 'Nintendo', color: '#00a6a6', extensions: ['gbc'] },
  gba: { core: 'gba', name: 'Game Boy Advance', short: 'GBA', maker: 'Nintendo', color: '#5a3fd6', extensions: ['gba'] },
  n64: { core: 'n64', name: 'Nintendo 64', short: 'N64', maker: 'Nintendo', color: '#2b8a3e', extensions: ['n64', 'z64', 'v64'] },
  nds: { core: 'nds', name: 'Nintendo DS', short: 'NDS', maker: 'Nintendo', color: '#9aa0a6', extensions: ['nds'] },
  vb: { core: 'vb', name: 'Virtual Boy', short: 'VB', maker: 'Nintendo', color: '#c20000', extensions: ['vb', 'vboy'] },
  segaMD: { core: 'segaMD', name: 'Sega Genesis / Mega Drive', short: 'Genesis', maker: 'Sega', color: '#1f6feb', extensions: ['md', 'gen', 'smd', 'sgd', '68k'] },
  segaMS: { core: 'segaMS', name: 'Sega Master System', short: 'SMS', maker: 'Sega', color: '#d93025', extensions: ['sms'] },
  segaGG: { core: 'segaGG', name: 'Sega Game Gear', short: 'Game Gear', maker: 'Sega', color: '#3c4043', extensions: ['gg'] },
  sega32x: { core: 'sega32x', name: 'Sega 32X', short: '32X', maker: 'Sega', color: '#f9ab00', extensions: ['32x'] },
  atari2600: { core: 'atari2600', name: 'Atari 2600', short: '2600', maker: 'Atari', color: '#b0592a', extensions: ['a26'] },
  atari7800: { core: 'atari7800', name: 'Atari 7800', short: '7800', maker: 'Atari', color: '#8c4a2f', extensions: ['a78'] },
  lynx: { core: 'lynx', name: 'Atari Lynx', short: 'Lynx', maker: 'Atari', color: '#f28b00', extensions: ['lnx'] },
  pce: { core: 'pce', name: 'PC Engine / TurboGrafx-16', short: 'PCE', maker: 'NEC', color: '#ff6d00', extensions: ['pce'] },
  ngp: { core: 'ngp', name: 'Neo Geo Pocket', short: 'NGP', maker: 'SNK', color: '#455a64', extensions: ['ngp', 'ngc'] },
  ws: { core: 'ws', name: 'WonderSwan', short: 'WS', maker: 'Bandai', color: '#00897b', extensions: ['ws', 'wsc'] },
  coleco: { core: 'coleco', name: 'ColecoVision', short: 'Coleco', maker: 'Coleco', color: '#5d4037', extensions: ['col'] },
  psx: { core: 'psx', name: 'PlayStation', short: 'PS1', maker: 'Sony', color: '#5f6368', extensions: ['cue', 'chd', 'pbp', 'iso', 'img', 'm3u'] },
  arcade: { core: 'arcade', name: 'Arcade (FBNeo)', short: 'Arcade', maker: 'Various', color: '#c51162', extensions: [] },
});

/** Extensions that several systems share, so the user has to choose. */
export const AMBIGUOUS_EXTENSIONS = Object.freeze({
  bin: ['segaMD', 'atari2600', 'psx', 'sega32x'],
  zip: ['arcade', 'nes', 'snes', 'segaMD', 'gba', 'gb'],
  '7z': ['arcade', 'nes', 'snes', 'segaMD', 'gba', 'gb'],
  rom: ['coleco', 'segaMD'],
});

export const MAX_CUSTOM_ROM_BYTES = 512 * 1024 * 1024;

export function getExtension(filename) {
  if (typeof filename !== 'string') return '';
  const clean = filename.split(/[?#]/)[0];
  const idx = clean.lastIndexOf('.');
  if (idx <= 0 || idx === clean.length - 1) return '';
  return clean.slice(idx + 1).toLowerCase();
}

/**
 * Work out which system a ROM file belongs to from its extension.
 * Returns `{ system, candidates }`; `system` is null when the user must pick.
 */
export function detectSystem(filename) {
  const ext = getExtension(filename);
  if (!ext) return { system: null, candidates: Object.keys(SYSTEMS) };
  for (const [id, sys] of Object.entries(SYSTEMS)) {
    if (sys.extensions.includes(ext)) return { system: id, candidates: [id] };
  }
  if (AMBIGUOUS_EXTENSIONS[ext]) return { system: null, candidates: [...AMBIGUOUS_EXTENSIONS[ext]] };
  return { system: null, candidates: Object.keys(SYSTEMS) };
}

export function getSystem(id) {
  return Object.prototype.hasOwnProperty.call(SYSTEMS, id) ? SYSTEMS[id] : null;
}

export function acceptedExtensions() {
  const all = new Set();
  for (const sys of Object.values(SYSTEMS)) sys.extensions.forEach((e) => all.add(e));
  Object.keys(AMBIGUOUS_EXTENSIONS).forEach((e) => all.add(e));
  return [...all].sort();
}
