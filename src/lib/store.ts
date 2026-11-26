import { useSyncExternalStore } from 'react';
import type { DB } from './model';
import { loadFromCloud, pushDiff, supabase } from './cloud';

const LOCAL_KEY = 'campeonatos-db-v1';
const empty = (): DB => ({ version: 1, promoters: [], drivers: [], teams: [], championships: [], seasons: [], manualTitles: [] });

/** 'local' = datos en este navegador · 'cloud' = datos en Supabase */
export const MODE: 'local' | 'cloud' = supabase ? 'cloud' : 'local';

export function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch { /* datos corruptos: empezamos de cero */ }
  return empty();
}

export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

let db: DB = MODE === 'local' ? loadLocal() : empty();
let synced: DB = db; // última versión confirmada por la base de datos
let sync: { state: SyncState; error?: string } = { state: 'idle' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function getDB() { return db; }

export function setDB(next: DB) {
  db = next;
  if (MODE === 'local') localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
  else scheduleFlush();
  emit();
}

/** Aplica una mutación sobre una copia y guarda. */
export function update(fn: (draft: DB) => void) {
  const draft = structuredClone(db);
  fn(draft);
  setDB(draft);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db);
}

export function useSync() {
  return useSyncExternalStore(subscribe, () => sync);
}

// --- Sincronización con la nube -------------------------------------------
// Los cambios se agrupan (p. ej. al escribir un nombre) y se envían cada ~0,7 s.
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

function scheduleFlush() {
  clearTimeout(timer);
  timer = setTimeout(flush, 700);
}

async function flush() {
  if (flushing) { scheduleFlush(); return; }
  if (synced === db) return;
  flushing = true;
  const target = db;
  sync = { state: 'saving' }; emit();
  try {
    await pushDiff(synced, target);
    synced = target;
    sync = { state: synced === db ? 'saved' : 'saving' };
  } catch (e) {
    sync = { state: 'error', error: (e as { message?: string }).message ?? String(e) };
  }
  flushing = false;
  emit();
  if (synced !== db && sync.state !== 'error') scheduleFlush();
}

export async function reloadFromCloud() {
  sync = { state: 'loading' }; emit();
  try {
    db = synced = await loadFromCloud();
    sync = { state: 'idle' };
  } catch (e) {
    sync = { state: 'error', error: (e as { message?: string }).message ?? String(e) };
  }
  emit();
}

export function retrySync() { sync = { state: 'saving' }; emit(); flush(); }

/** Al cerrar la pestaña con cambios sin guardar, avisa. */
if (MODE === 'cloud') {
  window.addEventListener('beforeunload', (e) => { if (synced !== db) e.preventDefault(); });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function exportJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `campeonatos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Importa una copia JSON. En la nube se añade a lo que ya hay; en local lo sustituye. */
export async function importJSON(file: File) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.promoters)) throw new Error('Archivo no válido');
  mergeIn({ ...empty(), ...data }, MODE === 'local');
}

export function mergeIn(other: DB, replace = false) {
  if (replace) { setDB({ ...empty(), ...other }); return; }
  update((d) => {
    (['promoters', 'drivers', 'teams', 'championships', 'seasons', 'manualTitles'] as const).forEach((k) => {
      const ids = new Set((d[k] as { id: string }[]).map((x) => x.id));
      (other[k] as { id: string }[]).forEach((x) => { if (!ids.has(x.id)) (d[k] as { id: string }[]).push(x as never); });
    });
  });
}

export const hasLocalData = () => loadLocal().promoters.length > 0;
export const clearLocalData = () => localStorage.removeItem(LOCAL_KEY);

/** Borra un campeonato con sus temporadas y títulos históricos. */
export function deleteChampionship(id: string) {
  update((d) => {
    d.seasons = d.seasons.filter((s) => s.championshipId !== id);
    d.manualTitles = d.manualTitles.filter((t) => t.championshipId !== id);
    d.championships = d.championships.filter((c) => c.id !== id);
  });
}

/** Borra una promotora y todo lo que contiene. */
export function deletePromoter(id: string) {
  update((d) => {
    const chIds = new Set(d.championships.filter((c) => c.promoterId === id).map((c) => c.id));
    d.seasons = d.seasons.filter((s) => !chIds.has(s.championshipId));
    d.championships = d.championships.filter((c) => c.promoterId !== id);
    d.drivers = d.drivers.filter((x) => x.promoterId !== id);
    d.teams = d.teams.filter((x) => x.promoterId !== id);
    d.manualTitles = d.manualTitles.filter((x) => x.promoterId !== id);
    d.promoters = d.promoters.filter((x) => x.id !== id);
  });
}
