import { describe, expect, it } from 'vitest';
import type { Round, Season } from './model';
import { driverStandings, presetConfig, teamStandings, isMathematicallyDecided } from './scoring';

const cls = (...ids: string[]) => ids.map((driverId) => ({ driverId, status: 'classified' as const }));

function season(rounds: Round[], preset = 'f1-2025', patch = {}): Season {
  return {
    id: 's', championshipId: 'c', categoryId: 'k', name: '2026', year: 2026, status: 'running',
    scoring: { ...presetConfig(preset), ...patch },
    entries: [
      { driverId: 'a', teamId: 't1' }, { driverId: 'b', teamId: 't1' },
      { driverId: 'c', teamId: 't2' }, { driverId: 'd', teamId: 't2' },
    ],
    rounds,
  };
}
const round = (id: string, order: string[], extra: Partial<Round> = {}): Round => ({
  id, name: id, multiplier: 1, hasSprint: false, race: { results: cls(...order) }, ...extra,
});

describe('puntuación', () => {
  it('suma puntos F1 por posición', () => {
    const st = driverStandings(season([round('r1', ['a', 'b', 'c', 'd']), round('r2', ['b', 'a', 'c', 'd'])]));
    expect(st.map((s) => [s.driverId, s.points])).toEqual([['a', 43], ['b', 43], ['c', 30], ['d', 24]]);
  });

  it('desempata por countback (más victorias, luego segundos...)', () => {
    const st = driverStandings(season([
      round('r1', ['a', 'c', 'b', 'd']), // a 25, b 15
      round('r2', ['c', 'b', 'a', 'd']), // a 15, b 18 -> a 40, b 33
      round('r3', ['b', 'd', 'c', 'a']), // b 25 -> 58, a 12 -> 52
    ], 'f1-2025'));
    expect(st[0].driverId).toBe('b');
  });

  it('marca empate real con la misma posición', () => {
    const tie = driverStandings(season([round('r1', ['a', 'b']), round('r2', ['b', 'a'])], 'f1-2025', { racePoints: [10, 10] }));
    // ambos 1 victoria y 1 segundo puesto => empate total
    expect(tie[0].position).toBe(1);
    expect(tie[1].position).toBe(1);
  });

  it('vuelta rápida solo si acaba en el top N', () => {
    const st = driverStandings(season([
      round('r1', ['a', 'b', 'c', 'd'], { race: { results: cls('a', 'b', 'c', 'd'), fastestLapDriverId: 'd' } }),
    ], 'f1-2019', { fastestLapTopN: 3 }));
    expect(st.find((s) => s.driverId === 'd')!.points).toBe(12);
    const st2 = driverStandings(season([
      round('r1', [], { race: { results: cls('a', 'b', 'c', 'd'), fastestLapDriverId: 'c' } }),
    ], 'f1-2019', { fastestLapTopN: 3 }));
    expect(st2.find((s) => s.driverId === 'c')!.points).toBe(16);
  });

  it('sprint, pole y doble puntuación', () => {
    const r: Round = {
      id: 'r1', name: 'Final', multiplier: 2, hasSprint: true,
      race: { results: cls('a', 'b'), poleDriverId: 'b' },
      sprint: { results: cls('b', 'a') },
    };
    const st = driverStandings(season([r], 'formula-e', { sprintPoints: [5, 3] }));
    // b: (18 + 3 pole + 5 sprint) * 2 = 52 ; a: (25 + 3) * 2 = 56
    expect(st.map((s) => [s.driverId, s.points])).toEqual([['a', 56], ['b', 52], ['c', 0], ['d', 0]]);
  });

  it('descarta los peores resultados (incluida ausencia)', () => {
    const st = driverStandings(season([
      round('r1', ['a', 'b']), round('r2', ['b', 'a']), round('r3', ['b']),
    ], 'f1-classic')); // 10-6, 2 descartes
    const a = st.find((s) => s.driverId === 'a')!;
    expect(a.grossPoints).toBe(16);
    expect(a.points).toBe(10); // se descartan el 6 y el 0
    expect(a.rounds.filter((r) => r.dropped)).toHaveLength(2);
  });

  it('no deja descartar una descalificación si se configura', () => {
    const st = driverStandings(season([
      round('r1', [], { race: { results: [{ driverId: 'a', status: 'dsq' }, ...cls('b')] } }),
      round('r2', ['a', 'b']),
      round('r3', ['b', 'a']),
    ], 'f1-classic', { dropWorst: 1, dropOnlyIfNotDsq: true }));
    const a = st.find((s) => s.driverId === 'a')!;
    expect(a.rounds[0].dropped).toBe(false);
    expect(a.points).toBe(10); // 0 (dsq, no descartable) + 10 + [6 descartado]
  });

  it('clasificación de equipos con los N mejores pilotos', () => {
    const s = season([round('r1', ['a', 'b', 'c', 'd'])], 'motogp');
    const teams = teamStandings(s);
    expect(teams.map((t) => [t.teamId, t.points])).toEqual([['t1', 45], ['t2', 29]]);
    const s1 = season([round('r1', ['a', 'b', 'c', 'd'])], 'motogp', { teamCountBest: 1 });
    expect(teamStandings(s1)[0].points).toBe(25);
  });

  it('detecta campeón matemático', () => {
    const rounds = [round('r1', ['a', 'b']), round('r2', ['a', 'b']), { id: 'r3', name: 'r3', multiplier: 1, hasSprint: false }];
    expect(isMathematicallyDecided(season(rounds))).toBe(false); // 50 vs 36, quedan 25
    const r4 = [...rounds.slice(0, 2), round('rx', ['a', 'c']), rounds[2]];
    expect(isMathematicallyDecided(season(r4))).toBe(true); // 75 vs 36, quedan 25
  });
});
