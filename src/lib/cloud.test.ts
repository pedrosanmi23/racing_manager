import { describe, expect, it } from 'vitest';
import { pushDiff } from './cloud';
import type { DB } from './model';
import { presetConfig } from './scoring';

const base = (): DB => ({ version: 1, promoters: [], drivers: [], teams: [], championships: [], seasons: [], manualTitles: [] });

function fakeClient() {
  const calls: string[] = [];
  const from = (table: string) => ({
    upsert: async (rows: { id: string }[]) => { calls.push(`upsert ${table} ${rows.map((r) => r.id).join(',')}`); return { error: null }; },
    delete: () => ({ in: async (_c: string, ids: string[]) => { calls.push(`delete ${table} ${ids.join(',')}`); return { error: null }; } }),
  });
  return { calls, client: { from } as never };
}

describe('sincronización con Supabase', () => {
  const a = base();
  a.promoters.push({ id: 'p1', name: 'P', color: '#000', createdAt: '' });
  a.championships.push({ id: 'c1', promoterId: 'p1', name: 'C', discipline: 'x', categories: [] });
  a.drivers.push({ id: 'd1', promoterId: 'p1', name: 'D1' }, { id: 'd2', promoterId: 'p1', name: 'D2' });
  a.seasons.push({ id: 's1', championshipId: 'c1', categoryId: 'k', name: '2026', year: 2026, status: 'running', scoring: presetConfig('f1-2025'), entries: [], rounds: [] });

  it('inserta de padres a hijos', async () => {
    const { calls, client } = fakeClient();
    await pushDiff(base(), a, client);
    expect(calls).toEqual(['upsert promoters p1', 'upsert championships c1', 'upsert drivers d1,d2', 'upsert seasons s1']);
  });

  it('solo envía lo que cambia y borra lo eliminado', async () => {
    const b = structuredClone(a);
    b.drivers[0].name = 'Cambiado';
    b.drivers.splice(1, 1);
    const { calls, client } = fakeClient();
    await pushDiff(a, b, client);
    expect(calls).toEqual(['upsert drivers d1', 'delete drivers d2']);
  });

  it('borra hijos antes que padres', async () => {
    const { calls, client } = fakeClient();
    await pushDiff(a, base(), client);
    expect(calls).toEqual(['delete seasons s1', 'delete drivers d1,d2', 'delete championships c1', 'delete promoters p1']);
  });
});
