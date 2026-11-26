export type ID = string;

export interface Promoter {
  id: ID;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

export interface Driver {
  id: ID;
  promoterId: ID;
  name: string;
  nationality?: string;
  defaultNumber?: number;
}

export interface Team {
  id: ID;
  promoterId: ID;
  name: string;
  color: string;
}

export interface Category {
  id: ID;
  name: string;
}

export interface Championship {
  id: ID;
  promoterId: ID;
  name: string;
  discipline: string; // monoplazas, motos, karting, rally...
  categories: Category[];
}

export type TiebreakRule = 'countback' | 'lastRace';

export interface ScoringConfig {
  presetId?: string;
  racePoints: number[]; // index 0 = P1
  sprintPoints: number[];
  polePoints: number;
  sprintPolePoints: number;
  fastestLapPoints: number;
  fastestLapTopN: number | null; // solo puntúa si acaba en el top N (null = siempre)
  finishBonus: number; // puntos por terminar clasificado
  dropWorst: number; // nº de peores rondas descartadas
  dropOnlyIfNotDsq: boolean; // las descalificaciones no se pueden descartar
  tiebreak: TiebreakRule;
  teamCountBest: number; // pilotos que puntúan por equipo en cada ronda (0 = todos)
  teamDropsApply: boolean;
}

export type ResultStatus = 'classified' | 'dnf' | 'dns' | 'dsq';

export interface ResultRow {
  driverId: ID;
  status: ResultStatus;
}

export interface SessionResult {
  results: ResultRow[]; // los 'classified' en orden de llegada
  poleDriverId?: ID;
  fastestLapDriverId?: ID;
}

export interface Round {
  id: ID;
  name: string;
  location?: string;
  date?: string; // ISO yyyy-mm-dd
  multiplier: number; // 1 normal, 2 doble puntuación, 0.5 media...
  hasSprint: boolean;
  race?: SessionResult;
  sprint?: SessionResult;
}

export interface Entry {
  driverId: ID;
  teamId?: ID;
  number?: number;
}

export type SeasonStatus = 'planned' | 'running' | 'finished';

export interface Season {
  id: ID;
  championshipId: ID;
  categoryId: ID;
  name: string; // "2026"
  year: number;
  status: SeasonStatus;
  scoring: ScoringConfig;
  entries: Entry[];
  rounds: Round[];
}

/** Campeones históricos añadidos a mano (antes de usar la app). */
export interface ManualTitle {
  id: ID;
  promoterId: ID;
  championshipId: ID;
  categoryId: ID;
  year: number;
  driverName: string;
  teamName?: string;
}

export interface DB {
  version: 1;
  promoters: Promoter[];
  drivers: Driver[];
  teams: Team[];
  championships: Championship[];
  seasons: Season[];
  manualTitles: ManualTitle[];
}
