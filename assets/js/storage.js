/**
 * Local persistence.
 *  - Custom ROMs live in IndexedDB so they survive reloads and never leave the device.
 *  - Favorites and "recently played" live in localStorage (small JSON blobs).
 */
const DB_NAME = 'retrobuddy';
const DB_VERSION = 1;
const ROM_STORE = 'roms';
const FAVORITES_KEY = 'retrobuddy:favorites';
const RECENTS_KEY = 'retrobuddy:recents';
const MAX_RECENTS = 12;

let dbPromise;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support IndexedDB, so custom ROMs cannot be saved.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROM_STORE)) {
        const store = db.createObjectStore(ROM_STORE, { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database is blocked by another open RetroBuddy tab. Close it and retry.'));
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(ROM_STORE, mode);
    const store = t.objectStore(ROM_STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const CustomRoms = {
  async add(file, system) {
    const record = {
      id: newId(),
      name: file.name,
      system,
      size: file.size,
      addedAt: Date.now(),
      lastPlayed: null,
      blob: file,
    };
    await tx('readwrite', (s) => reqToPromise(s.put(record)));
    return record;
  },
  async get(id) {
    return tx('readonly', (s) => reqToPromise(s.get(id)));
  },
  async list() {
    const all = await tx('readonly', (s) => reqToPromise(s.getAll()));
    return (all || []).map(({ blob, ...meta }) => meta).sort((a, b) => (b.lastPlayed || b.addedAt) - (a.lastPlayed || a.addedAt));
  },
  async update(id, changes) {
    return tx('readwrite', async (s) => {
      const rec = await reqToPromise(s.get(id));
      if (!rec) throw new Error('ROM not found');
      Object.assign(rec, changes);
      await reqToPromise(s.put(rec));
      return rec;
    });
  },
  async remove(id) {
    return tx('readwrite', (s) => reqToPromise(s.delete(id)));
  },
};

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or disabled */ }
}

export const Favorites = {
  all() { return new Set(readJson(FAVORITES_KEY, [])); },
  has(id) { return this.all().has(id); },
  toggle(id) {
    const set = this.all();
    if (set.has(id)) set.delete(id); else set.add(id);
    writeJson(FAVORITES_KEY, [...set]);
    return set.has(id);
  },
};

/** A recent entry is `{ kind: 'catalog' | 'custom', id, at }`. */
export const Recents = {
  all() {
    const list = readJson(RECENTS_KEY, []);
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.kind) : [];
  },
  record(kind, id) {
    const list = this.all().filter((r) => !(r.kind === kind && r.id === id));
    list.unshift({ kind, id, at: Date.now() });
    writeJson(RECENTS_KEY, list.slice(0, MAX_RECENTS));
  },
  remove(kind, id) {
    writeJson(RECENTS_KEY, this.all().filter((r) => !(r.kind === kind && r.id === id)));
  },
};

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
