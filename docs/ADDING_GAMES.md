# Adding games to the library

The bundled library must contain **only games you are legally allowed to redistribute**. This page explains how to check that, and how to add a game in a few minutes.

## 1. License checklist

Add a game only if **all** of these are true:

- [ ] The author has released it under an **open-source or explicit free-redistribution license**: MIT, Zlib, BSD, Apache-2.0, MPL-2.0, GPL-2.0/3.0, CC0, CC-BY, WTFPL, Unlicense or similar. "Free to download" on its own is **not** a redistribution license.
- [ ] The license covers the **assets** (graphics, music), not just the code. Check the README for separate asset licenses.
- [ ] It doesn't use characters, music or names owned by someone else (no Mario, Sonic, Pokémon, Tetris…).
- [ ] For **GPL** games: the `source` field links to the source code. That link is how RetroBuddy satisfies the GPL's source-availability requirement.

Good places to find qualifying games:

- [Homebrew Hub (gbdev)](https://hh.gbdev.io/): Game Boy / GBC, with licenses listed per game ([database repo](https://github.com/gbdev/database))
- [gbadev games database](https://github.com/gbadev-org/games): Game Boy Advance
- GitHub releases of open-source NES projects (search for `nes homebrew` and check the license)
- itch.io game-jam entries (GBA Jam, NESdev Compo, Game Boy Competition). Check each page's license.

## 2. Add the files

1. Put the ROM in the matching folder, using a **kebab-case** file name:
   - `games/nes/` for `.nes`
   - `games/gb/` for `.gb` / `.gbc`
   - `games/gba/` for `.gba`
   - For other systems, create a folder (e.g. `games/md/`) and also add the extension to `ROM_PATTERN` in `sw.js` so it gets cached offline.
2. Add a screenshot as `assets/covers/<id>.png`. A 4:3 image of about 240–480 px wide is ideal; pixel art is scaled crisply. If you have no screenshot, leave `cover` out and a generated cover is shown.

Keep ROMs well under **100 MB** (GitHub's hard limit). Anything over ~25 MB loads slowly on mobile data, and the validator warns about it.

## 3. Register it in `games/games.json`

```json
{
  "id": "my-cool-game",
  "title": "My Cool Game",
  "system": "nes",
  "file": "games/nes/my-cool-game.nes",
  "cover": "assets/covers/my-cool-game.png",
  "developer": "Jane Doe",
  "year": 2024,
  "genre": "Platformer",
  "players": 1,
  "description": "One or two sentences shown on the info panel and in the player help.",
  "license": "MIT",
  "source": "https://github.com/janedoe/my-cool-game",
  "website": "https://janedoe.itch.io/my-cool-game"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | ✅ | Unique, kebab-case. Used in URLs: `play.html?game=<id>` |
| `title` | ✅ | Display name |
| `system` | ✅ | A key from `assets/js/systems.js`: `nes`, `snes`, `gb`, `gbc`, `gba`, `n64`, `nds`, `segaMD`, `segaMS`, `segaGG`, … |
| `file` | ✅ | Path inside `games/`. The extension must belong to the system |
| `license` | ✅ | SPDX identifier (e.g. `MIT`, `GPL-3.0-or-later`). Must start with a known open license |
| `source` | ✅ | `https://` link to the source code / release page |
| `description` | ✅ | Plain text |
| `cover` | — | Path inside `assets/covers/` |
| `developer`, `year`, `genre` | — | Shown on cards and in the info panel |
| `players` | — | Integer 1–4. Values above 1 show "N players" on the card |
| `website` | — | `https://` link to the official page |

Games appear in the order they are listed. Group them by system.

## 4. Credit the author

Add a row to [CREDITS.md](../CREDITS.md) with the title, author, license and source link.

## 5. Validate and test

```bash
npm run validate     # schema, file existence, ROM header, cover, license, size checks
npm test             # unit tests (includes the validator)
ALL_GAMES=1 npm run test:e2e   # boots every game in headless Chrome
```

The validator checks ROM headers for the bundled systems:

| System | Check |
| --- | --- |
| NES | iNES magic `NES\x1A` at offset 0 |
| GB / GBC | Nintendo logo bytes at `0x104` |
| GBA | ARM branch instruction at the entry point (homebrew often leaves the logo blank, which emulators accept) |

Finally, bump `VERSION` in `sw.js` (the catalog is network-first, but this also refreshes cached shell files), then commit and push.

## Removing a game

Delete its entry from `games/games.json`, its ROM and its cover, and remove it from `CREDITS.md`. `npm run validate` warns about any ROM files that are no longer referenced.
