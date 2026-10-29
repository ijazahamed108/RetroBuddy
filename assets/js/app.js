import { SYSTEMS, getSystem, detectSystem, MAX_CUSTOM_ROM_BYTES } from './systems.js';
import { loadCatalog } from './catalog.js';
import { CustomRoms, Favorites, Recents, storageEstimate, requestPersistentStorage } from './storage.js';
import { $, $$, escapeHtml, formatBytes, timeAgo, debounce, toast, ICONS } from './util.js';
import { registerServiceWorker, setupInstallButton } from './pwa.js';

const state = {
  games: [],
  customRoms: [],
  filter: 'all',
  query: '',
};

function playUrl(kind, id) {
  return kind === 'custom' ? `play.html?rom=${encodeURIComponent(id)}` : `play.html?game=${encodeURIComponent(id)}`;
}

function coverElement(game) {
  const sys = getSystem(game.system);
  const wrap = document.createElement('div');
  wrap.className = 'card-cover';
  wrap.style.setProperty('--sys-color', sys.color);
  if (game.cover) {
    const img = document.createElement('img');
    img.src = game.cover;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.replaceWith(generatedCover(game.title)), { once: true });
    wrap.appendChild(img);
  } else {
    wrap.appendChild(generatedCover(game.title));
  }
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = sys.short;
  badge.style.setProperty('--sys-color', sys.color);
  wrap.appendChild(badge);
  const overlay = document.createElement('div');
  overlay.className = 'play-overlay';
  overlay.innerHTML = '<span>▶ PLAY</span>';
  wrap.appendChild(overlay);
  return wrap;
}

function generatedCover(title) {
  const el = document.createElement('div');
  el.className = 'generated-cover';
  el.textContent = title;
  return el;
}

function gameCard(game, { compact = false } = {}) {
  const card = document.createElement('article');
  card.className = 'card';

  const link = document.createElement('a');
  link.className = 'card-link';
  link.href = playUrl('catalog', game.id);
  link.setAttribute('aria-label', `Play ${game.title} (${getSystem(game.system).name})`);
  link.appendChild(coverElement(game));

  const body = document.createElement('div');
  body.className = 'card-body';
  const meta = [game.genre, game.players > 1 ? `${game.players} players` : null].filter(Boolean).join(' · ');
  body.innerHTML = `<h3 class="card-title">${escapeHtml(game.title)}</h3><p class="card-meta">${escapeHtml(meta)}</p>`;
  link.appendChild(body);
  card.appendChild(link);

  if (!compact) {
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const fav = Favorites.has(game.id);
    actions.innerHTML = `
      <button class="icon-btn fav-btn" type="button" data-fav="${escapeHtml(game.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favorites: ${escapeHtml(game.title)}">${ICONS.star}</button>
      <button class="icon-btn" type="button" data-info="${escapeHtml(game.id)}" aria-label="About ${escapeHtml(game.title)}">${ICONS.info}</button>`;
    card.appendChild(actions);
  }
  return card;
}

function customCard(rom) {
  const systemId = getSystem(rom.system) ? rom.system : 'nes';
  const sys = SYSTEMS[systemId];
  const card = document.createElement('article');
  card.className = 'card';
  const link = document.createElement('a');
  link.className = 'card-link';
  link.href = playUrl('custom', rom.id);
  link.setAttribute('aria-label', `Play ${rom.name}`);
  link.appendChild(coverElement({ title: rom.name.replace(/\.[^.]+$/, ''), system: systemId }));
  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = `<h3 class="card-title">${escapeHtml(rom.name)}</h3><p class="card-meta">My ROM · ${escapeHtml(sys.short)}</p>`;
  link.appendChild(body);
  card.appendChild(link);
  return card;
}

/* ---------------- Library grid ---------------- */

function matches(game) {
  if (state.filter === 'favorites' && !Favorites.has(game.id)) return false;
  if (state.filter !== 'all' && state.filter !== 'favorites' && game.system !== state.filter) return false;
  if (!state.query) return true;
  const hay = `${game.title} ${game.genre || ''} ${game.developer || ''} ${getSystem(game.system).name}`.toLowerCase();
  return state.query.split(/\s+/).every((w) => hay.includes(w));
}

function renderFilters() {
  const counts = state.games.reduce((acc, g) => { acc[g.system] = (acc[g.system] || 0) + 1; return acc; }, {});
  const favCount = state.games.filter((g) => Favorites.has(g.id)).length;
  const options = [
    { id: 'all', label: 'All', count: state.games.length },
    ...Object.keys(counts).map((id) => ({ id, label: SYSTEMS[id].short, count: counts[id] })),
    { id: 'favorites', label: '★ Favorites', count: favCount },
  ];
  $('#filters').innerHTML = options.map((o) => `
    <button class="chip" type="button" data-filter="${o.id}" aria-pressed="${state.filter === o.id}">
      ${escapeHtml(o.label)}<span class="count">${o.count}</span>
    </button>`).join('');
}

function renderGrid() {
  const grid = $('#grid');
  const list = state.games.filter(matches);
  grid.replaceChildren(...list.map((g) => gameCard(g)));
  grid.setAttribute('aria-busy', 'false');
  const empty = $('#grid-empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = state.filter === 'favorites' && !state.query
      ? 'No favorites yet. Tap the ★ on any game to pin it here.'
      : 'No games match your search.';
  }
}

function renderRecents() {
  const section = $('#recents-section');
  const items = Recents.all().map((r) => {
    if (r.kind === 'catalog') {
      const g = state.games.find((x) => x.id === r.id);
      return g ? gameCard(g, { compact: true }) : null;
    }
    const rom = state.customRoms.find((x) => x.id === r.id);
    return rom ? customCard(rom) : null;
  }).filter(Boolean);
  section.hidden = items.length === 0;
  $('#recents').replaceChildren(...items);
}

/* ---------------- Game info dialog ---------------- */

function openGameDialog(id) {
  const game = state.games.find((g) => g.id === id);
  if (!game) return;
  const sys = getSystem(game.system);
  const dlg = $('#game-dialog');
  const rows = [
    ['System', sys.name],
    ['Developer', game.developer],
    ['Year', game.year],
    ['Genre', game.genre],
    ['Players', game.players],
    ['License', game.license],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
  $('#game-dialog-body').innerHTML = `
    <div class="dialog-head">
      <h2 id="game-dialog-title">${escapeHtml(game.title)}</h2>
      <button class="icon-btn" type="button" data-close aria-label="Close">${ICONS.close}</button>
    </div>
    ${game.cover ? `<div class="dialog-cover"><img src="${escapeHtml(game.cover)}" alt="Screenshot of ${escapeHtml(game.title)}"></div>` : ''}
    <p>${escapeHtml(game.description || '')}</p>
    <dl class="kv">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
    <p>
      ${game.source ? `<a href="${escapeHtml(game.source)}" target="_blank" rel="noopener">Source code</a>` : ''}
      ${game.website ? ` · <a href="${escapeHtml(game.website)}" target="_blank" rel="noopener">Official page</a>` : ''}
    </p>
    <div class="dialog-actions">
      <button class="btn" type="button" data-close>Close</button>
      <a class="btn btn-primary" href="${playUrl('catalog', game.id)}">▶ Play now</a>
    </div>`;
  dlg.showModal();
}

/* ---------------- Custom ROMs ---------------- */

async function refreshCustomRoms() {
  try {
    state.customRoms = await CustomRoms.list();
  } catch (err) {
    state.customRoms = [];
    console.warn(err);
  }
  renderRomList();
  renderRecents();
}

function renderRomList() {
  const list = $('#rom-list');
  $('#rom-empty').hidden = state.customRoms.length > 0;
  list.innerHTML = state.customRoms.map((rom) => {
    const sys = getSystem(rom.system);
    const when = rom.lastPlayed ? `played ${timeAgo(rom.lastPlayed)}` : `added ${timeAgo(rom.addedAt)}`;
    return `
      <li class="rom-item">
        <span class="badge" data-sys-color="${escapeHtml(sys?.color || '')}">${escapeHtml(sys?.short || rom.system)}</span>
        <div>
          <div class="name">${escapeHtml(rom.name)}</div>
          <div class="meta">${formatBytes(rom.size)} · ${escapeHtml(when)}</div>
        </div>
        <div class="actions">
          <a class="btn btn-primary btn-sm" href="${playUrl('custom', rom.id)}">▶ Play</a>
          <button class="btn btn-sm" type="button" data-rom-system="${escapeHtml(rom.id)}">Change system</button>
          <button class="btn btn-sm btn-danger" type="button" data-rom-delete="${escapeHtml(rom.id)}">Delete</button>
        </div>
      </li>`;
  }).join('');
  $$('[data-sys-color]', list).forEach((el) => el.style.setProperty('--sys-color', el.dataset.sysColor));
  updateStorageInfo();
}

async function updateStorageInfo() {
  const est = await storageEstimate();
  $('#storage-info').textContent = est && est.quota
    ? `Browser storage used: ${formatBytes(est.usage)} of ${formatBytes(est.quota)} available.`
    : '';
}

function chooseSystem(fileName, candidates) {
  return new Promise((resolve) => {
    const dlg = $('#system-dialog');
    $('#system-dialog-text').textContent = `We couldn't tell which console “${fileName}” is for. Pick one:`;
    $('#system-options').innerHTML = candidates.map((id) => `
      <button class="btn btn-sm" type="button" data-pick="${id}">${escapeHtml(SYSTEMS[id].name)}</button>`).join('');
    const onClick = (e) => {
      const btn = e.target.closest('[data-pick]');
      if (!btn) return;
      resolve(btn.dataset.pick);
      dlg.close();
    };
    $('#system-options').addEventListener('click', onClick);
    dlg.addEventListener('close', () => {
      $('#system-options').removeEventListener('click', onClick);
      resolve(null);
    }, { once: true });
    dlg.showModal();
  });
}

async function addRomFiles(files) {
  const added = [];
  for (const file of files) {
    if (file.size === 0) { toast(`“${file.name}” is empty.`, 'error'); continue; }
    if (file.size > MAX_CUSTOM_ROM_BYTES) {
      toast(`“${file.name}” is larger than ${formatBytes(MAX_CUSTOM_ROM_BYTES)}.`, 'error');
      continue;
    }
    let { system, candidates } = detectSystem(file.name);
    if (!system) system = await chooseSystem(file.name, candidates);
    if (!system) continue;
    try {
      added.push(await CustomRoms.add(file, system));
    } catch (err) {
      console.error(err);
      toast(err?.name === 'QuotaExceededError'
        ? 'Not enough browser storage for this ROM. Delete some ROMs and try again.'
        : `Could not save “${file.name}”: ${err.message || err}`, 'error', 6000);
    }
  }
  if (!added.length) return;
  requestPersistentStorage();
  await refreshCustomRoms();
  if (added.length === 1) {
    location.href = playUrl('custom', added[0].id);
  } else {
    toast(`Added ${added.length} ROMs to My ROMs.`, 'success');
    $('#my-roms').scrollIntoView();
  }
}

async function changeRomSystem(id) {
  const rom = state.customRoms.find((r) => r.id === id);
  if (!rom) return;
  const system = await chooseSystem(rom.name, Object.keys(SYSTEMS));
  if (!system) return;
  await CustomRoms.update(id, { system });
  toast(`“${rom.name}” will now run as ${SYSTEMS[system].name}.`, 'success');
  refreshCustomRoms();
}

async function deleteRom(id) {
  const rom = state.customRoms.find((r) => r.id === id);
  if (!rom || !confirm(`Delete “${rom.name}” from this browser?`)) return;
  await CustomRoms.remove(id);
  Recents.remove('custom', id);
  toast('ROM deleted.');
  refreshCustomRoms();
}

/* ---------------- Wiring ---------------- */

function setupDialogs() {
  $$('dialog').forEach((dlg) => {
    $$('[data-close]:empty', dlg).forEach((b) => { b.innerHTML = ICONS.close; });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });
  $$('[data-open]').forEach((btn) => btn.addEventListener('click', () => $(`#${btn.dataset.open}`).showModal()));
}

function setupRomInput() {
  const input = $('#rom-input');
  $$('[data-action="pick-rom"]').forEach((b) => b.addEventListener('click', () => input.click()));
  input.addEventListener('change', () => {
    const files = [...input.files];
    input.value = '';
    if (files.length) addRomFiles(files);
  });

  const zone = $('#dropzone');
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    depth++;
    zone.classList.add('is-dragging');
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) zone.classList.remove('is-dragging');
  });
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    depth = 0;
    zone.classList.remove('is-dragging');
    addRomFiles([...e.dataTransfer.files]);
  });
}

function setupEvents() {
  $('#search').addEventListener('input', debounce((e) => {
    state.query = e.target.value.trim().toLowerCase();
    renderGrid();
  }, 120));

  $('#filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    renderFilters();
    renderGrid();
  });

  $('#grid').addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const on = Favorites.toggle(fav.dataset.fav);
      fav.setAttribute('aria-pressed', String(on));
      renderFilters();
      if (state.filter === 'favorites') renderGrid();
      return;
    }
    const info = e.target.closest('[data-info]');
    if (info) openGameDialog(info.dataset.info);
  });

  $('#rom-list').addEventListener('click', (e) => {
    const del = e.target.closest('[data-rom-delete]');
    if (del) return deleteRom(del.dataset.romDelete);
    const sys = e.target.closest('[data-rom-system]');
    if (sys) return changeRomSystem(sys.dataset.romSystem);
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) { renderRecents(); refreshCustomRoms(); }
  });
}

async function init() {
  setupDialogs();
  setupRomInput();
  setupEvents();
  registerServiceWorker();
  setupInstallButton($('#install-btn'));

  try {
    state.games = await loadCatalog();
  } catch (err) {
    console.error(err);
    $('#grid').setAttribute('aria-busy', 'false');
    $('#grid-empty').hidden = false;
    $('#grid-empty').textContent = 'The game library could not be loaded. Check your connection and refresh.';
  }
  renderFilters();
  renderGrid();
  await refreshCustomRoms();
}

init();
