import { describe, expect, it } from 'vitest';
import { importDrivers, importTeams, parseCSV } from './csv';
import type { DB } from './model';
import { presetConfig } from './scoring';

let n = 0;
const id = () => 'id' + ++n;
const db = (): DB => ({
  version: 1, promoters: [{ id: 'p', name: 'P', color: '#000', createdAt: '' }],
  drivers: [{ id: 'd0', promoterId: 'p', name: 'Lucía Prieto', nationality: 'ESP', defaultNumber: 28 }],
  teams: [], championships: [{ id: 'c', promoterId: 'p', name: 'C', discipline: 'x', categories: [{ id: 'k', name: 'K' }] }],
  seasons: [{ id: 's', championshipId: 'c', categoryId: 'k', name: '2026', year: 2026, status: 'planned', scoring: presetConfig('motogp'), entries: [], rounds: [] }],
  manualTitles: [],
});

describe('CSV', () => {
  it('lee comas, punto y coma, comillas y BOM', () => {
    expect(parseCSV('﻿Nombre,Dorsal\n"Pérez, Juan",7\r\n\n')).toEqual([['Nombre', 'Dorsal'], ['Pérez, Juan', '7']]);
    expect(parseCSV('Nombre;Nacionalidad\nAna;esp')).toEqual([['Nombre', 'Nacionalidad'], ['Ana', 'esp']]);
  });

  it('importa pilotos, actualiza los existentes y avisa de dorsales repetidos', () => {
    const d = db();
    const s = importDrivers(d, 'p', parseCSV('Nombre,Nacionalidad,Dorsal\nlucía prieto,esp,30\nTom Smith,ENG,30\n,ITA,4\nKai,JPN,x'), id);
    expect(s.created).toBe(2);
    expect(s.updated).toBe(1);
    expect(d.drivers.find((x) => x.id === 'd0')!.defaultNumber).toBe(30);
    expect(d.drivers.find((x) => x.name === 'Tom Smith')!.nationality).toBe('ENG');
    expect(s.warnings.join(' ')).toMatch(/dorsal 30 ya lo lleva/);
    expect(s.warnings.join(' ')).toMatch(/sin nombre/);
    expect(s.warnings.join(' ')).toMatch(/no válido/);
  });

  it('en una temporada inscribe a los pilotos y crea los equipos que falten', () => {
    const d = db();
    const s = importDrivers(d, 'p', parseCSV('Piloto,Dorsal,Equipo\nAna,7,Rojo\nBea,8,rojo\nCris,9,Azul'), id, 's');
    expect(s.enrolled).toBe(3);
    expect(s.teamsCreated).toBe(2);
    const e = d.seasons[0].entries;
    expect(e[0].teamId).toBe(e[1].teamId);
    expect(e.map((x) => x.number)).toEqual([7, 8, 9]);
  });

  it('importa equipos con color', () => {
    const d = db();
    const s = importTeams(d, 'p', parseCSV('Nombre,Color\nRojo,e10600\nAzul,azul\nRojo,#000000'), id);
    expect(s.created).toBe(2);
    expect(s.updated).toBe(1);
    expect(d.teams.find((t) => t.name === 'Rojo')!.color).toBe('#000000');
    expect(s.warnings).toHaveLength(1);
  });

  it('sin columna Nombre no importa nada', () => {
    const d = db();
    const s = importDrivers(d, 'p', parseCSV('a,b\n1,2'), id);
    expect(s.created).toBe(0);
    expect(s.warnings[0]).toMatch(/Nombre/);
  });
});
