import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, detectSystem, getExtension, getSystem, acceptedExtensions, AMBIGUOUS_EXTENSIONS } from '../assets/js/systems.js';

const EMULATORJS_SYSTEMS = new Set([
  'atari5200', 'vb', 'nds', 'arcade', 'nes', 'gb', 'coleco', 'segaMS', 'segaMD', 'segaGG', 'segaCD',
  'sega32x', 'sega', 'lynx', 'mame', 'ngp', 'pce', 'pcfx', 'psx', 'ws', 'gba', 'n64', '3do', 'psp',
  'atari7800', 'snes', 'atari2600', 'jaguar', 'segaSaturn', 'amiga', 'c64', 'c128', 'pet', 'plus4', 'vic20', 'dos',
]);

test('every system maps to a core EmulatorJS 4.2.3 understands', () => {
  for (const [id, sys] of Object.entries(SYSTEMS)) {
    assert.ok(EMULATORJS_SYSTEMS.has(sys.core), `${id} -> ${sys.core}`);
  }
});

test('no extension is claimed by two systems', () => {
  const seen = new Map();
  for (const [id, sys] of Object.entries(SYSTEMS)) {
    for (const ext of sys.extensions) {
      assert.ok(!seen.has(ext), `.${ext} claimed by ${seen.get(ext)} and ${id}`);
      assert.ok(!(ext in AMBIGUOUS_EXTENSIONS), `.${ext} is both specific and ambiguous`);
      seen.set(ext, id);
    }
  }
});

test('getExtension handles edge cases', () => {
  assert.equal(getExtension('Game.NES'), 'nes');
  assert.equal(getExtension('path/to/my.game.gba'), 'gba');
  assert.equal(getExtension('https://x.test/rom.gb?v=2#frag'), 'gb');
  assert.equal(getExtension('noext'), '');
  assert.equal(getExtension('.hidden'), '');
  assert.equal(getExtension('trailingdot.'), '');
  assert.equal(getExtension(undefined), '');
});

test('detectSystem picks the right system for unambiguous extensions', () => {
  assert.equal(detectSystem('nova.nes').system, 'nes');
  assert.equal(detectSystem('world.SFC').system, 'snes');
  assert.equal(detectSystem('tetris.gb').system, 'gb');
  assert.equal(detectSystem('city.gbc').system, 'gbc');
  assert.equal(detectSystem('adv.gba').system, 'gba');
  assert.equal(detectSystem('sonic.md').system, 'segaMD');
  assert.equal(detectSystem('mario.z64').system, 'n64');
  assert.equal(detectSystem('game.cue').system, 'psx');
});

test('detectSystem asks the user for ambiguous or unknown files', () => {
  const bin = detectSystem('game.bin');
  assert.equal(bin.system, null);
  assert.ok(bin.candidates.includes('segaMD'));
  const zip = detectSystem('arcade.zip');
  assert.equal(zip.system, null);
  assert.ok(zip.candidates.includes('arcade'));
  const unknown = detectSystem('mystery.xyz');
  assert.equal(unknown.system, null);
  assert.equal(unknown.candidates.length, Object.keys(SYSTEMS).length);
});

test('Game Boy and Game Boy Color share the gambatte-backed core', () => {
  assert.equal(SYSTEMS.gb.core, 'gb');
  assert.equal(SYSTEMS.gbc.core, 'gb');
});

test('getSystem rejects prototype keys', () => {
  assert.equal(getSystem('toString'), null);
  assert.equal(getSystem('__proto__'), null);
  assert.equal(getSystem('nes').short, 'NES');
});

test('acceptedExtensions is sorted and unique', () => {
  const list = acceptedExtensions();
  assert.deepEqual(list, [...new Set(list)].sort());
  assert.ok(list.includes('nes') && list.includes('zip'));
});
