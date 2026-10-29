import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../scripts/validate-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('bundled catalog passes validation', () => {
  const { errors, games } = validateCatalog(ROOT);
  assert.deepEqual(errors, []);
  assert.ok(games.length >= 10, 'expected a meaningful library');
});

test('only permissive / open licenses are bundled', () => {
  const { games } = validateCatalog(ROOT);
  const allowed = /^(MIT|Zlib|GPL-3\.0(-only|-or-later)?|MPL-2\.0|BSD-[23]-Clause|Apache-2\.0|CC0-1\.0|Unlicense|WTFPL)\b/;
  for (const g of games) assert.match(g.license, allowed, `${g.id}: ${g.license}`);
});

test('service worker precaches files that exist', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  assert.ok(files.length > 5);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `missing precached file ${f}`);
});

test('every local JS module is precached by the service worker', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) {
    assert.ok(sw.includes(`assets/js/${f}`), `sw.js does not precache assets/js/${f}`);
  }
});

test('EmulatorJS version is pinned consistently', () => {
  const play = fs.readFileSync(path.join(ROOT, 'assets/js/play.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const version = play.match(/EMULATORJS_VERSION = '([\d.]+)'/)[1];
  assert.ok(sw.includes(`rb-emulatorjs-${version}`), 'sw.js emulator cache name must match the pinned version');
});

test('validator reports problems in a broken catalog', () => {
  const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-test-'));
  try {
    fs.mkdirSync(path.join(tmp, 'games', 'nes'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'games', 'nes', 'bad.nes'), 'not a rom');
    fs.writeFileSync(path.join(tmp, 'games', 'games.json'), JSON.stringify({
      games: [
        { id: 'bad', title: 'Bad', system: 'nes', file: 'games/nes/bad.nes', license: 'MIT', source: 'http://insecure', description: 'x' },
        { id: 'bad', title: 'Dup', system: 'snes', file: 'games/nes/missing.sfc', license: 'MIT', source: 'https://ok.test', description: 'x' },
        { id: 'Weird ID', title: 'W', system: 'nope', file: 'games/x.nes', license: 'MIT', source: 'https://ok.test', description: 'x' },
      ],
    }));
    const { errors } = validateCatalog(tmp);
    const joined = errors.join('\n');
    assert.match(joined, /source must be an https URL/);
    assert.match(joined, /no valid iNES header/);
    assert.match(joined, /duplicate id/);
    assert.match(joined, /ROM file not found/);
    assert.match(joined, /kebab-case/);
    assert.match(joined, /unknown system/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
