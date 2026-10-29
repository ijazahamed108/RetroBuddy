import { getSystem } from './systems.js';

let cache;

/** Load and sanity-check the bundled game catalog (`games/games.json`). */
export function loadCatalog() {
  if (cache) return cache;
  cache = fetch('games/games.json', { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load game library (HTTP ${res.status})`);
      return res.json();
    })
    .then((data) => {
      const games = Array.isArray(data?.games) ? data.games : [];
      return games.filter((g) => g && g.id && g.title && g.file && getSystem(g.system));
    });
  cache.catch(() => { cache = undefined; });
  return cache;
}

export async function findGame(id) {
  const games = await loadCatalog();
  return games.find((g) => g.id === id) || null;
}
