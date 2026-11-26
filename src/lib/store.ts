import { useSyncExternalStore } from 'react';
import type { DB } from './model';

const KEY = 'campeonatos-db-v1';
const empty = (): DB => ({ version: 1, promoters: [], drivers: [], teams: [], championships: [], seasons: [], manualTitles: [] });

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch { /* datos corruptos: empezamos de cero */ }
  return empty();
}

let db: DB = load();
const listeners = new Set<() => void>();

export function getDB() { return db; }

export function setDB(next: DB) {
  db = next;
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
}

/** Aplica una mutación sobre una copia y guarda. */
export function update(fn: (draft: DB) => void) {
  const draft = structuredClone(db);
  fn(draft);
  setDB(draft);
}

export function useDB(): DB {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => db);
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

export async function importJSON(file: File) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.promoters)) throw new Error('Archivo no válido');
  setDB({ ...empty(), ...data });
}
