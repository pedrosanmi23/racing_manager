import type { ID, Round, ScoringConfig, Season, SessionResult } from './model';

export interface ScoringPreset {
  id: string;
  name: string;
  description: string;
  config: ScoringConfig;
}

const base: Omit<ScoringConfig, 'racePoints' | 'sprintPoints'> = {
  polePoints: 0,
  sprintPolePoints: 0,
  fastestLapPoints: 0,
  fastestLapTopN: null,
  finishBonus: 0,
  dropWorst: 0,
  dropOnlyIfNotDsq: false,
  tiebreak: 'countback',
  teamCountBest: 0,
  teamDropsApply: false,
};

export const PRESETS: ScoringPreset[] = [
  {
    id: 'f1-2025',
    name: 'Fórmula 1 (2025)',
    description: '25-18-15-12-10-8-6-4-2-1, sprint 8→1, sin punto por vuelta rápida.',
    config: { ...base, presetId: 'f1-2025', racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1] },
  },
  {
    id: 'f1-2019',
    name: 'Fórmula 1 (2019–2024)',
    description: 'Como F1 actual + 1 punto por vuelta rápida si acabas en el top 10.',
    config: {
      ...base, presetId: 'f1-2019', racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      fastestLapPoints: 1, fastestLapTopN: 10,
    },
  },
  {
    id: 'motogp',
    name: 'MotoGP',
    description: '25-20-16-13-11-10-9-8-7-6-5-4-3-2-1, sprint 12→1 (mitad de puntos).',
    config: {
      ...base, presetId: 'motogp', racePoints: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], sprintPoints: [12, 9, 7, 6, 5, 4, 3, 2, 1],
      teamCountBest: 2,
    },
  },
  {
    id: 'formula-e',
    name: 'Fórmula E',
    description: '25→1 a los 10 primeros, +3 pole, +1 vuelta rápida (top 10).',
    config: { ...base, presetId: 'formula-e', racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprintPoints: [], polePoints: 3, fastestLapPoints: 1, fastestLapTopN: 10 },
  },
  {
    id: 'f1-classic',
    name: 'F1 clásico (1991–2002) con descartes',
    description: '10-6-4-3-2-1 y se descartan los 2 peores resultados.',
    config: { ...base, presetId: 'f1-classic', racePoints: [10, 6, 4, 3, 2, 1], sprintPoints: [], dropWorst: 2 },
  },
  {
    id: 'club',
    name: 'Club / karting amateur',
    description: '20-17-15-13-11-10-9-8-7-6-5-4-3-2-1, +1 por terminar, +1 pole, 1 descarte.',
    config: {
      ...base, presetId: 'club', racePoints: [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], sprintPoints: [10, 8, 6, 5, 4, 3, 2, 1],
      finishBonus: 1, polePoints: 1, fastestLapPoints: 1, dropWorst: 1,
    },
  },
];

export function presetConfig(id: string): ScoringConfig {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return structuredClone(p.config);
}

export interface RoundScore {
  roundId: ID;
  racePos?: number; // posición en carrera (si clasificado)
  raceStatus?: string;
  sprintPos?: number;
  pole: boolean;
  fastestLap: boolean;
  points: number; // con multiplicador
  dropped: boolean;
  participated: boolean;
}

export interface DriverStanding {
  driverId: ID;
  position: number;
  points: number; // neto (tras descartes)
  grossPoints: number;
  rounds: RoundScore[];
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  starts: number;
  dnfs: number;
  bestFinish?: number;
  tiedWithPrev: boolean;
}

export interface TeamStanding {
  teamId: ID;
  position: number;
  points: number;
  rounds: { roundId: ID; points: number; dropped: boolean }[];
  wins: number;
  podiums: number;
}

export const isRoundScored = (r: Round) => !!r.race && r.race.results.length > 0;

function sessionPoints(
  session: SessionResult | undefined,
  driverId: ID,
  table: number[],
  polePts: number,
  cfg: ScoringConfig,
  isRace: boolean,
) {
  if (!session) return { pts: 0, pos: undefined as number | undefined, status: undefined as string | undefined, pole: false, fl: false, present: false };
  const row = session.results.find((r) => r.driverId === driverId);
  const classified = session.results.filter((r) => r.status === 'classified');
  const idx = classified.findIndex((r) => r.driverId === driverId);
  const pos = idx >= 0 ? idx + 1 : undefined;
  let pts = pos ? table[pos - 1] ?? 0 : 0;
  const pole = session.poleDriverId === driverId;
  if (pole) pts += polePts;
  const fl = session.fastestLapDriverId === driverId;
  if (fl && isRace && cfg.fastestLapPoints && pos && (cfg.fastestLapTopN == null || pos <= cfg.fastestLapTopN)) {
    pts += cfg.fastestLapPoints;
  }
  if (isRace && pos && cfg.finishBonus) pts += cfg.finishBonus;
  return { pts, pos, status: row?.status, pole, fl, present: !!row };
}

export function scoreDriverRound(round: Round, driverId: ID, cfg: ScoringConfig): RoundScore {
  const race = sessionPoints(round.race, driverId, cfg.racePoints, cfg.polePoints, cfg, true);
  const sprint = round.hasSprint
    ? sessionPoints(round.sprint, driverId, cfg.sprintPoints, cfg.sprintPolePoints, cfg, false)
    : undefined;
  const raw = race.pts + (sprint?.pts ?? 0);
  return {
    roundId: round.id,
    racePos: race.pos,
    raceStatus: race.status,
    sprintPos: sprint?.pos,
    pole: race.pole,
    fastestLap: race.fl,
    points: raw * (round.multiplier ?? 1),
    dropped: false,
    participated: race.present || !!sprint?.present,
  };
}

/** Marca como descartadas las N peores rondas. Devuelve puntos netos. */
function applyDrops<T extends { points: number; dropped: boolean }>(items: T[], n: number, canDrop: (t: T) => boolean): number {
  if (n > 0) {
    const candidates = items.filter(canDrop).sort((a, b) => a.points - b.points);
    candidates.slice(0, n).forEach((c) => (c.dropped = true));
  }
  return items.reduce((s, i) => s + (i.dropped ? 0 : i.points), 0);
}

function compareCountback(a: DriverStanding, b: DriverStanding): number {
  const maxPos = Math.max(...[...a.rounds, ...b.rounds].map((r) => r.racePos ?? 0), 0);
  for (let p = 1; p <= maxPos; p++) {
    const ca = a.rounds.filter((r) => r.racePos === p).length;
    const cb = b.rounds.filter((r) => r.racePos === p).length;
    if (ca !== cb) return cb - ca;
  }
  return 0;
}

function compareLastRace(a: DriverStanding, b: DriverStanding): number {
  for (let i = a.rounds.length - 1; i >= 0; i--) {
    const pa = a.rounds[i].racePos ?? Infinity;
    const pb = b.rounds[i].racePos ?? Infinity;
    if (pa !== pb) return pa - pb;
  }
  return 0;
}

export function driverStandings(season: Season): DriverStanding[] {
  const cfg = season.scoring;
  const rounds = season.rounds.filter(isRoundScored);
  const driverIds = new Set<ID>(season.entries.map((e) => e.driverId));
  rounds.forEach((r) => {
    r.race?.results.forEach((x) => driverIds.add(x.driverId));
    r.sprint?.results.forEach((x) => driverIds.add(x.driverId));
  });

  const rows: DriverStanding[] = [...driverIds].map((driverId) => {
    const rs = rounds.map((r) => scoreDriverRound(r, driverId, cfg));
    const gross = rs.reduce((s, r) => s + r.points, 0);
    const net = applyDrops(rs, cfg.dropWorst, (r) => !(cfg.dropOnlyIfNotDsq && r.raceStatus === 'dsq'));
    const positions = rs.map((r) => r.racePos).filter((p): p is number => p != null);
    return {
      driverId,
      position: 0,
      points: net,
      grossPoints: gross,
      rounds: rs,
      wins: positions.filter((p) => p === 1).length,
      podiums: positions.filter((p) => p <= 3).length,
      poles: rs.filter((r) => r.pole).length,
      fastestLaps: rs.filter((r) => r.fastestLap).length,
      starts: rs.filter((r) => r.raceStatus && r.raceStatus !== 'dns').length,
      dnfs: rs.filter((r) => r.raceStatus === 'dnf').length,
      bestFinish: positions.length ? Math.min(...positions) : undefined,
      tiedWithPrev: false,
    };
  });

  const tiebreak = cfg.tiebreak === 'lastRace' ? compareLastRace : compareCountback;
  rows.sort((a, b) => b.points - a.points || tiebreak(a, b));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied = !!prev && prev.points === r.points && tiebreak(prev, r) === 0;
    r.tiedWithPrev = tied;
    r.position = tied ? prev.position : i + 1;
  });
  return rows;
}

export function teamStandings(season: Season, drivers = driverStandings(season)): TeamStanding[] {
  const cfg = season.scoring;
  const teamOf = new Map(season.entries.map((e) => [e.driverId, e.teamId]));
  const teamIds = [...new Set(season.entries.map((e) => e.teamId).filter((t): t is ID => !!t))];
  const rounds = season.rounds.filter(isRoundScored);

  const rows: TeamStanding[] = teamIds.map((teamId) => {
    const members = drivers.filter((d) => teamOf.get(d.driverId) === teamId);
    const rs = rounds.map((r, i) => {
      const pts = members.map((m) => m.rounds[i].points).sort((a, b) => b - a);
      const counted = cfg.teamCountBest > 0 ? pts.slice(0, cfg.teamCountBest) : pts;
      return { roundId: r.id, points: counted.reduce((s, p) => s + p, 0), dropped: false };
    });
    const total = applyDrops(rs, cfg.teamDropsApply ? cfg.dropWorst : 0, () => true);
    const positions = members.flatMap((m) => m.rounds.map((r) => r.racePos)).filter((p): p is number => p != null);
    return {
      teamId,
      position: 0,
      points: total,
      rounds: rs,
      wins: positions.filter((p) => p === 1).length,
      podiums: positions.filter((p) => p <= 3).length,
    };
  });
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums);
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

/** Puntos máximos que aún puede sumar un piloto en las rondas que faltan (sin descartes). */
export function maxPointsRemaining(season: Season): number {
  const cfg = season.scoring;
  return season.rounds
    .filter((r) => !isRoundScored(r))
    .reduce((s, r) => {
      const race = (cfg.racePoints[0] ?? 0) + cfg.polePoints + cfg.fastestLapPoints + cfg.finishBonus;
      const sprint = r.hasSprint ? (cfg.sprintPoints[0] ?? 0) + cfg.sprintPolePoints : 0;
      return s + (race + sprint) * (r.multiplier ?? 1);
    }, 0);
}

/** ¿El líder ya es campeón matemáticamente? (aproximación sin descartes) */
export function isMathematicallyDecided(season: Season, standings = driverStandings(season)): boolean {
  if (standings.length < 2) return false;
  const remaining = maxPointsRemaining(season);
  if (season.scoring.dropWorst > 0 && remaining > 0) return false;
  return standings[0].points - standings[1].points > remaining;
}
