import type { Championship, DB, ID, Season } from './model';
import { driverStandings, isRoundScored, teamStandings } from './scoring';

export const byId = <T extends { id: ID }>(list: T[], id?: ID) => list.find((x) => x.id === id);

export function categoryName(ch: Championship | undefined, catId: ID) {
  return ch?.categories.find((c) => c.id === catId)?.name ?? '—';
}

export function seasonsOfPromoter(db: DB, promoterId: ID): Season[] {
  const chIds = new Set(db.championships.filter((c) => c.promoterId === promoterId).map((c) => c.id));
  return db.seasons.filter((s) => chIds.has(s.championshipId));
}

export interface TitleRow {
  championshipId: ID;
  categoryId: ID;
  year: number;
  seasonId?: ID;
  driverId?: ID;
  driverName: string;
  teamId?: ID;
  teamName?: string;
  points?: number;
  manual: boolean;
}

/** Palmarés: campeones de temporadas finalizadas + títulos históricos añadidos a mano. */
export function titles(db: DB, promoterId: ID): TitleRow[] {
  const out: TitleRow[] = [];
  for (const s of seasonsOfPromoter(db, promoterId)) {
    if (s.status !== 'finished') continue;
    const ds = driverStandings(s);
    const ts = teamStandings(s, ds);
    const champ = ds[0];
    if (!champ) continue;
    const team = ts[0];
    out.push({
      championshipId: s.championshipId, categoryId: s.categoryId, year: s.year, seasonId: s.id,
      driverId: champ.driverId, driverName: byId(db.drivers, champ.driverId)?.name ?? '?',
      teamId: team?.teamId, teamName: team ? byId(db.teams, team.teamId)?.name : undefined,
      points: champ.points, manual: false,
    });
  }
  for (const m of db.manualTitles.filter((t) => t.promoterId === promoterId)) {
    out.push({ championshipId: m.championshipId, categoryId: m.categoryId, year: m.year, driverName: m.driverName, teamName: m.teamName, manual: true });
  }
  return out.sort((a, b) => b.year - a.year);
}

export interface DriverCareer {
  driverId: ID;
  titles: number;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  seasons: number;
}

export function careerStats(db: DB, promoterId: ID): DriverCareer[] {
  const map = new Map<ID, DriverCareer>();
  const get = (id: ID) => {
    if (!map.has(id)) map.set(id, { driverId: id, titles: 0, starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, seasons: 0 });
    return map.get(id)!;
  };
  for (const s of seasonsOfPromoter(db, promoterId)) {
    if (!s.rounds.some(isRoundScored)) continue;
    const ds = driverStandings(s);
    ds.forEach((d, i) => {
      const c = get(d.driverId);
      c.seasons++;
      c.starts += d.starts; c.wins += d.wins; c.podiums += d.podiums; c.poles += d.poles;
      c.fastestLaps += d.fastestLaps; c.points += d.points;
      if (i === 0 && s.status === 'finished') c.titles++;
    });
  }
  return [...map.values()].sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.podiums - a.podiums || b.points - a.points);
}

export const fmtDate = (d?: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';

export const STATUS_LABEL: Record<Season['status'], string> = { planned: 'Planificada', running: 'En curso', finished: 'Finalizada' };
