import type { DB, ID } from './model';

/** Lee un CSV (separado por comas o punto y coma, con comillas opcionales). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const COLUMNS: Record<string, string[]> = {
  name: ['nombre', 'name', 'piloto', 'driver', 'equipo', 'team'],
  nationality: ['nacionalidad', 'nationality', 'nac', 'pais', 'country'],
  number: ['dorsal', 'numero', 'number', 'num', 'no'],
  team: ['equipo', 'team', 'escuderia'],
  color: ['color', 'colour'],
};

/** Convierte filas a objetos según la cabecera (acepta nombres en español o inglés). */
function toRecords(rows: string[][], wanted: (keyof typeof COLUMNS)[]) {
  const [header, ...body] = rows;
  if (!header) return [];
  const idx: Partial<Record<string, number>> = {};
  const taken = new Set<number>();
  for (const k of wanted) {
    // Se prueban los sinónimos por orden de preferencia («Nombre» antes que «Equipo»)
    let i = -1;
    for (const syn of COLUMNS[k]) { i = header.findIndex((h, j) => !taken.has(j) && norm(h) === syn); if (i >= 0) break; }
    if (i >= 0) { idx[k] = i; taken.add(i); }
  }
  return body.map((r, line) => ({
    line: line + 2,
    ...Object.fromEntries(wanted.map((k) => [k, idx[k] != null ? r[idx[k]!] ?? '' : ''])),
  })) as ({ line: number } & Record<string, string>)[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  teamsCreated: number;
  enrolled: number;
  warnings: string[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Importa pilotos (Nombre, Nacionalidad, Dorsal y opcionalmente Equipo) en una promotora.
 * Si ya existe un piloto con el mismo nombre se actualizan sus datos. Si se pasa seasonId,
 * además se inscriben en esa temporada con su dorsal y equipo.
 */
export function importDrivers(db: DB, promoterId: ID, rows: string[][], newId: () => string, seasonId?: ID): ImportSummary {
  const recs = toRecords(rows, ['name', 'nationality', 'number', 'team']);
  const s: ImportSummary = { created: 0, updated: 0, teamsCreated: 0, enrolled: 0, warnings: [] };
  const season = seasonId ? db.seasons.find((x) => x.id === seasonId) : undefined;
  const seenNumbers = new Map<number, string>();
  if (!recs.length || !rows[0].some((h) => COLUMNS.name.includes(norm(h)))) {
    s.warnings.push('No encuentro la columna «Nombre» en la primera fila.');
    return s;
  }
  for (const r of recs) {
    if (!r.name) { s.warnings.push(`Línea ${r.line}: sin nombre, se omite.`); continue; }
    let num: number | undefined;
    if (r.number) {
      num = Number(r.number.replace(/^#/, ''));
      if (!Number.isInteger(num) || num < 0) { s.warnings.push(`Línea ${r.line}: dorsal «${r.number}» no válido, se deja vacío.`); num = undefined; }
      else if (seenNumbers.has(num)) s.warnings.push(`Línea ${r.line}: el dorsal ${num} ya lo lleva ${seenNumbers.get(num)}.`);
      else seenNumbers.set(num, r.name);
    }
    const nat = r.nationality ? r.nationality.toUpperCase() : undefined;
    let driver = db.drivers.find((d) => d.promoterId === promoterId && same(d.name, r.name));
    if (driver) {
      if (nat) driver.nationality = nat;
      if (num != null) driver.defaultNumber = num;
      s.updated++;
    } else {
      driver = { id: newId(), promoterId, name: r.name, nationality: nat, defaultNumber: num };
      db.drivers.push(driver);
      s.created++;
    }
    let teamId: ID | undefined;
    if (r.team) teamId = ensureTeam(db, promoterId, r.team, newId, s).id;
    if (season) {
      const entry = season.entries.find((e) => e.driverId === driver!.id);
      if (entry) {
        if (num != null) entry.number = num;
        if (teamId) entry.teamId = teamId;
      } else {
        season.entries.push({ driverId: driver.id, number: num ?? driver.defaultNumber, teamId });
        s.enrolled++;
      }
    }
  }
  return s;
}

const PALETTE = ['#e10600', '#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#ec4899', '#0891b2', '#f97316', '#64748b', '#84cc16'];

function ensureTeam(db: DB, promoterId: ID, name: string, newId: () => string, s: ImportSummary, color?: string) {
  let team = db.teams.find((t) => t.promoterId === promoterId && same(t.name, name));
  if (!team) {
    const n = db.teams.filter((t) => t.promoterId === promoterId).length;
    team = { id: newId(), promoterId, name: name.trim(), color: color || PALETTE[n % PALETTE.length] };
    db.teams.push(team);
    s.teamsCreated++;
  } else if (color) team.color = color;
  return team;
}

/** Importa equipos (Nombre y opcionalmente Color en formato #rrggbb). */
export function importTeams(db: DB, promoterId: ID, rows: string[][], newId: () => string): ImportSummary {
  const recs = toRecords(rows, ['name', 'color']);
  const s: ImportSummary = { created: 0, updated: 0, teamsCreated: 0, enrolled: 0, warnings: [] };
  if (!recs.length || !rows[0].some((h) => COLUMNS.name.includes(norm(h)))) {
    s.warnings.push('No encuentro la columna «Nombre» en la primera fila.');
    return s;
  }
  for (const r of recs) {
    if (!r.name) { s.warnings.push(`Línea ${r.line}: sin nombre, se omite.`); continue; }
    let color = r.color;
    if (color && !/^#?[0-9a-f]{6}$/i.test(color)) { s.warnings.push(`Línea ${r.line}: color «${color}» no válido (usa #rrggbb).`); color = ''; }
    if (color && !color.startsWith('#')) color = '#' + color;
    const before = s.teamsCreated;
    ensureTeam(db, promoterId, r.name, newId, s, color || undefined);
    if (s.teamsCreated === before) s.updated++;
  }
  s.created = s.teamsCreated;
  return s;
}

export const DRIVERS_TEMPLATE = 'Nombre,Nacionalidad,Dorsal,Equipo\nAna García,ESP,7,Equipo Rojo\nTom Smith,ENG,21,Equipo Azul\n';
export const TEAMS_TEMPLATE = 'Nombre,Color\nEquipo Rojo,#e10600\nEquipo Azul,#1d4ed8\n';
