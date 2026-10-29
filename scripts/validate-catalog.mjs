#!/usr/bin/env node
/**
 * Validates games/games.json and the ROM files it references.
 * Run with `npm run validate`. Exits non-zero when any error is found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SYSTEMS, getExtension } from '../assets/js/systems.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GITHUB_FILE_LIMIT = 100 * 1024 * 1024;
const WARN_SIZE = 25 * 1024 * 1024;
const ROM_EXTENSIONS = new Set(Object.values(SYSTEMS).flatMap((s) => s.extensions).concat(['zip', '7z', 'bin']));

const HEADER_CHECKS = {
  nes: { offset: 0, bytes: [0x4e, 0x45, 0x53, 0x1a], label: 'iNES header "NES\\x1A"' },
  gb: { offset: 0x104, bytes: [0xce, 0xed, 0x66, 0x66], label: 'Nintendo logo at 0x104' },
  gbc: { offset: 0x104, bytes: [0xce, 0xed, 0x66, 0x66], label: 'Nintendo logo at 0x104' },
  // Many homebrew GBA ROMs leave the logo blank (emulators don't need it), so check the ARM entry branch.
  gba: { offset: 0x03, bytes: [0xea], label: 'ARM branch instruction at the entry point' },
};

function isHttpsUrl(v) {
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function validateCatalog(root = ROOT) {
  const errors = [];
  const warnings = [];
  const catalogPath = path.join(root, 'games', 'games.json');

  let data;
  try {
    data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (err) {
    return { errors: [`games/games.json is not valid JSON: ${err.message}`], warnings, games: [] };
  }
  const games = Array.isArray(data.games) ? data.games : [];
  if (!games.length) errors.push('games/games.json has no games');

  const ids = new Set();
  const referenced = new Set();

  for (const [i, g] of games.entries()) {
    const where = `games[${i}]${g?.id ? ` (${g.id})` : ''}`;
    for (const key of ['id', 'title', 'system', 'file', 'license', 'source', 'description']) {
      if (typeof g[key] !== 'string' || !g[key].trim()) errors.push(`${where}: missing "${key}"`);
    }
    if (g.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)) errors.push(`${where}: id must be kebab-case`);
    if (ids.has(g.id)) errors.push(`${where}: duplicate id`);
    ids.add(g.id);

    const sys = SYSTEMS[g.system];
    if (!sys) { errors.push(`${where}: unknown system "${g.system}"`); continue; }

    if (g.source && !isHttpsUrl(g.source)) errors.push(`${where}: source must be an https URL`);
    if (g.website && !isHttpsUrl(g.website)) errors.push(`${where}: website must be an https URL`);
    if (g.players !== undefined && !(Number.isInteger(g.players) && g.players >= 1 && g.players <= 4)) {
      errors.push(`${where}: players must be an integer 1–4`);
    }

    if (typeof g.file === 'string') {
      if (!g.file.startsWith('games/') || g.file.includes('..')) {
        errors.push(`${where}: file must live inside games/`);
        continue;
      }
      const filePath = path.join(root, g.file);
      referenced.add(path.resolve(filePath));
      if (!fs.existsSync(filePath)) { errors.push(`${where}: ROM file not found: ${g.file}`); continue; }
      const ext = getExtension(g.file);
      if (!sys.extensions.includes(ext)) errors.push(`${where}: ".${ext}" is not a ${sys.short} extension`);
      const size = fs.statSync(filePath).size;
      if (size === 0) errors.push(`${where}: ROM file is empty`);
      if (size > GITHUB_FILE_LIMIT) errors.push(`${where}: ROM exceeds GitHub's 100 MB file limit`);
      else if (size > WARN_SIZE) warnings.push(`${where}: ROM is ${(size / 1048576).toFixed(1)} MB — slow on mobile data`);

      const check = HEADER_CHECKS[g.system];
      if (check && size >= check.offset + check.bytes.length) {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(check.bytes.length);
        fs.readSync(fd, buf, 0, buf.length, check.offset);
        fs.closeSync(fd);
        if (!check.bytes.every((b, j) => buf[j] === b)) errors.push(`${where}: ${g.file} has no valid ${check.label}`);
      }
    }

    if (g.cover !== undefined) {
      if (typeof g.cover !== 'string' || !g.cover.startsWith('assets/covers/')) errors.push(`${where}: cover must live in assets/covers/`);
      else if (!fs.existsSync(path.join(root, g.cover))) errors.push(`${where}: cover not found: ${g.cover}`);
    }
  }

  for (const file of walk(path.join(root, 'games'))) {
    if (ROM_EXTENSIONS.has(getExtension(file)) && !referenced.has(path.resolve(file))) {
      warnings.push(`Unreferenced ROM file: ${path.relative(root, file)}`);
    }
  }

  return { errors, warnings, games };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { errors, warnings, games } = validateCatalog();
  warnings.forEach((w) => console.warn(`warn  ${w}`));
  errors.forEach((e) => console.error(`error ${e}`));
  if (errors.length) {
    console.error(`\n✖ Catalog invalid: ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`✔ Catalog OK: ${games.length} games, ${warnings.length} warning(s).`);
}
