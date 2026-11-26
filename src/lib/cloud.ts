import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Championship, DB, Driver, ManualTitle, Promoter, Season, Team } from './model';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente de Supabase, o null si la app funciona solo en local. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

type Row = Record<string, unknown>;

/** Correspondencia entre colecciones de la app y tablas de la base de datos. */
interface TableMap<T> {
  table: string;
  key: keyof DB;
  toRow: (x: T) => Row;
  fromRow: (r: Row) => T;
}

const promoters: TableMap<Promoter> = {
  table: 'promoters', key: 'promoters',
  toRow: (p) => ({ id: p.id, name: p.name, description: p.description ?? null, color: p.color }),
  fromRow: (r) => ({ id: r.id as string, name: r.name as string, description: (r.description as string) ?? undefined, color: r.color as string, createdAt: r.created_at as string }),
};
const championships: TableMap<Championship> = {
  table: 'championships', key: 'championships',
  toRow: (c) => ({ id: c.id, promoter_id: c.promoterId, name: c.name, discipline: c.discipline, categories: c.categories }),
  fromRow: (r) => ({ id: r.id as string, promoterId: r.promoter_id as string, name: r.name as string, discipline: r.discipline as string, categories: r.categories as Championship['categories'] }),
};
const drivers: TableMap<Driver> = {
  table: 'drivers', key: 'drivers',
  toRow: (d) => ({ id: d.id, promoter_id: d.promoterId, name: d.name, nationality: d.nationality ?? null, default_number: d.defaultNumber ?? null }),
  fromRow: (r) => ({ id: r.id as string, promoterId: r.promoter_id as string, name: r.name as string, nationality: (r.nationality as string) ?? undefined, defaultNumber: (r.default_number as number) ?? undefined }),
};
const teams: TableMap<Team> = {
  table: 'teams', key: 'teams',
  toRow: (t) => ({ id: t.id, promoter_id: t.promoterId, name: t.name, color: t.color }),
  fromRow: (r) => ({ id: r.id as string, promoterId: r.promoter_id as string, name: r.name as string, color: r.color as string }),
};
const seasons: TableMap<Season> = {
  table: 'seasons', key: 'seasons',
  // promoter_id lo rellena un trigger a partir del campeonato
  toRow: (s) => ({ id: s.id, championship_id: s.championshipId, promoter_id: '', category_id: s.categoryId, name: s.name, year: s.year, status: s.status, scoring: s.scoring, entries: s.entries, rounds: s.rounds }),
  fromRow: (r) => ({ id: r.id as string, championshipId: r.championship_id as string, categoryId: r.category_id as string, name: r.name as string, year: r.year as number, status: r.status as Season['status'], scoring: r.scoring as Season['scoring'], entries: r.entries as Season['entries'], rounds: r.rounds as Season['rounds'] }),
};
const manualTitles: TableMap<ManualTitle> = {
  table: 'manual_titles', key: 'manualTitles',
  toRow: (m) => ({ id: m.id, promoter_id: m.promoterId, championship_id: m.championshipId, category_id: m.categoryId, year: m.year, driver_name: m.driverName, team_name: m.teamName ?? null }),
  fromRow: (r) => ({ id: r.id as string, promoterId: r.promoter_id as string, championshipId: r.championship_id as string, categoryId: r.category_id as string, year: r.year as number, driverName: r.driver_name as string, teamName: (r.team_name as string) ?? undefined }),
};

// Orden de padres a hijos: así se insertan; los borrados van al revés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLES: TableMap<any>[] = [promoters, championships, drivers, teams, seasons, manualTitles];

export async function loadFromCloud(): Promise<DB> {
  const sb = supabase!;
  const db: DB = { version: 1, promoters: [], drivers: [], teams: [], championships: [], seasons: [], manualTitles: [] };
  const results = await Promise.all(TABLES.map((t) => sb.from(t.table).select('*')));
  results.forEach((res, i) => {
    if (res.error) throw res.error;
    const t = TABLES[i];
    (db[t.key] as unknown[]) = (res.data ?? []).map(t.fromRow);
  });
  db.promoters.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return db;
}

/** Envía a la base de datos solo lo que ha cambiado entre dos versiones. */
export async function pushDiff(prev: DB, next: DB, sb: Pick<SupabaseClient, 'from'> = supabase!) {
  const plan = TABLES.map((t) => {
    const before = new Map((prev[t.key] as { id: string }[]).map((x) => [x.id, JSON.stringify(t.toRow(x))]));
    const after = (next[t.key] as { id: string }[]);
    const upserts = after.filter((x) => before.get(x.id) !== JSON.stringify(t.toRow(x))).map(t.toRow);
    const afterIds = new Set(after.map((x) => x.id));
    const deletes = [...before.keys()].filter((id) => !afterIds.has(id));
    return { t, upserts, deletes };
  });
  for (const { t, upserts } of plan) {
    if (!upserts.length) continue;
    const { error } = await sb.from(t.table).upsert(upserts);
    if (error) throw error;
  }
  for (const { t, deletes } of [...plan].reverse()) {
    if (!deletes.length) continue;
    const { error } = await sb.from(t.table).delete().in('id', deletes);
    if (error) throw error;
  }
}

export async function inviteMember(promoterId: string, email: string) {
  const { data, error } = await supabase!.rpc('invite_member', { p: promoterId, member_email: email });
  if (error) throw error;
  return data as 'ok' | 'not_found';
}

export async function listMembers(promoterId: string) {
  const { data, error } = await supabase!.rpc('list_members', { p: promoterId });
  if (error) throw error;
  return data as { user_id: string; email: string; role: 'owner' | 'editor' }[];
}
