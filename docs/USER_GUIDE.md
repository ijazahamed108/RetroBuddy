# RetroBuddy user guide

This guide covers playing games, controls on every kind of device, saving, and loading your own ROMs.

## Playing a game

1. Open the site and scroll to **Game library** (or use the search box and the system filters: **NES**, **GB**, **GBC**, **GBA**, **★ Favorites**).
2. Tap or click a game. The player page opens.
3. Press the **Start Game** button in the middle of the screen. Browsers only allow game audio after you tap something, which is why this button exists.
4. Use the **‹** button in the top-left corner to go back to the library.

Tap **ⓘ** on a game card to see its description, developer, license and a link to its source code. Tap **☆** to add it to your favorites.

Games you have played appear in **Continue playing** at the top of the library.

## Controls

### Phones and tablets

- An **on-screen gamepad** (D-pad, A/B, Start/Select, plus L/R on systems that have them) appears automatically on touch screens.
- **Rotate to landscape** for the biggest picture. On phones in landscape, the top bar collapses into a small **‹** back button.
- Tap the **☰** icon (top-right of the game screen) for the emulator menu: save states, settings, fullscreen and more.
- Tip: add RetroBuddy to your home screen (see [Install as an app](#install-as-an-app)) to get a full-screen experience without browser bars.

### Keyboard (laptops and desktops)

| Console button | Key |
| --- | --- |
| D-pad | Arrow keys |
| A | `Z` |
| B | `X` |
| X | `A` |
| Y | `S` |
| L / R | `Q` / `E` |
| Start | `Enter` |
| Select | `V` |

You can remap every key: move the mouse over the game, open the **🎮 Control Settings** button in the bottom toolbar, click a button and press the new key.

### Gamepads

Any standard USB or Bluetooth controller works: Xbox, PlayStation DualShock/DualSense, Switch Pro, 8BitDo and others. Connect it, then **press any button** so the browser detects it. Mapping can be adjusted in **Control Settings** as well. Up to four controllers are supported, which is handy for two-player games like *8-Bit Table Tennis* and *AIRPLANZ*.

## Saving your progress

There are two kinds of saves:

- **In-game saves** (battery saves): for games with a built-in save feature, progress is written to your browser's storage automatically.
- **Save states**: an instant snapshot of the whole game that you can take at any moment. Use the **💾 Save State** / **📂 Load State** buttons in the emulator toolbar (or the ☰ menu on mobile).

Saves are stored **in this browser on this device only**. Clearing your browser data removes them. To move a save to another device, use **Export Save File** in the emulator menu and **Import Save File** on the other device.

## Loading your own ROMs

You can play your own legally obtained ROM files (for example, backups of cartridges you own).

1. On the library page, drag a ROM file onto **Drop a ROM here**, or press **Load your own ROM** / **Choose file**.
2. RetroBuddy detects the console from the file extension and starts the game immediately.
3. If the extension is shared by several consoles (like `.bin`, `.zip` or `.iso`), you'll be asked **Which system?**. Pick the right one.
4. Your ROM is saved under **My ROMs** so you can replay it later. There you can **Play**, **Change system** (if it was detected wrongly) or **Delete** it.

**Privacy:** ROMs are stored in your browser's local database (IndexedDB). They are **never uploaded** anywhere.

### Supported systems and file types

| System | Extensions |
| --- | --- |
| NES / Famicom | `.nes` `.fds` `.unf` `.unif` |
| Super Nintendo | `.sfc` `.smc` `.fig` `.swc` `.bs` |
| Game Boy / Game Boy Color | `.gb` / `.gbc` |
| Game Boy Advance | `.gba` |
| Nintendo 64 | `.n64` `.z64` `.v64` |
| Nintendo DS | `.nds` |
| Virtual Boy | `.vb` `.vboy` |
| Sega Genesis / Mega Drive | `.md` `.gen` `.smd` `.sgd` `.68k` (and `.bin`) |
| Sega Master System | `.sms` |
| Sega Game Gear | `.gg` |
| Sega 32X | `.32x` |
| PlayStation | `.chd` `.pbp` `.cue` `.iso` `.img` `.m3u` (and `.bin`) |
| PC Engine / TurboGrafx-16 | `.pce` |
| Atari 2600 / 7800 / Lynx | `.a26` / `.a78` / `.lnx` |
| Neo Geo Pocket (Color) | `.ngp` `.ngc` |
| WonderSwan (Color) | `.ws` `.wsc` |
| ColecoVision | `.col` |
| Arcade (FBNeo) | `.zip` (choose *Arcade*) |

`.zip` and `.7z` archives are extracted automatically.

**Notes**

- **Nintendo 64, Nintendo DS and PlayStation** are demanding. They run well on laptops and recent phones but may be slow on older or budget devices.
- **PlayStation** discs work best as a single `.chd` or `.pbp` file. Multi-file `.cue` + `.bin` sets need to be zipped together first.
- No BIOS files are needed for the supported systems (PlayStation uses a built-in high-level BIOS). Disc-based systems that strictly require a copyrighted BIOS, such as Sega CD, are therefore not offered.
- **Arcade** games must match the FBNeo ROM set version. Neo Geo games additionally need `neogeo.zip`, which is not supported.
- The maximum custom ROM size is 512 MB, and your browser may impose a lower storage limit. The **My ROMs** section shows how much storage is used.

## Install as an app

RetroBuddy is a Progressive Web App:

- **Android / Chrome / Edge**: tap **Install** in the site header, or use the browser menu → *Install app* / *Add to Home screen*.
- **iPhone / iPad (Safari)**: tap **Share** → **Add to Home Screen**.
- **Desktop Chrome / Edge**: click the install icon in the address bar, or **Install** in the header.

After a game has been played once, it is cached and **playable offline**.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No sound | Press the on-screen **Start Game** button, check that the device isn't muted, and check the volume slider in the emulator toolbar. On iPhone, turn off silent mode. |
| Stuck on "Loading…" / "Emulator did not start" | The emulator is downloaded the first time you play each system (a few MB). Check your connection and reload. Corporate networks or ad blockers that block `cdn.emulatorjs.org` will prevent it from loading. |
| Gamepad not detected | Press a button on the controller *after* the page has loaded. Some browsers only expose gamepads after an input. |
| Game runs slowly | Close other tabs, try landscape/fullscreen, and lower the shader settings in the emulator menu. N64/PS1/NDS need a fairly powerful device. |
| Wrong system picked for my ROM | In **My ROMs**, press **Change system**. |
| "ROM not found" after clearing browser data | Custom ROMs live in browser storage. Add the file again. |
| My saves disappeared | Saves are per-browser and per-device. Private/incognito windows delete everything when closed. |
