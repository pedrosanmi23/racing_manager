import type { DB, Driver, Round, Season, Team } from './model';
import { presetConfig } from './scoring';
import { uid } from './store';

// Generador pseudoaleatorio con semilla para que la demo sea siempre igual
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export function buildDemo(db: DB): DB {
  const rand = rng(42);
  const pid = uid();
  const next = structuredClone(db);
  next.promoters.push({ id: pid, name: 'Iberian Racing Series', color: '#e10600', description: 'Promotora de demostración con monoplazas y motos.', createdAt: new Date().toISOString() });

  const teams: Team[] = [
    ['Scuderia Tajo', '#d62828'], ['Ebro Motorsport', '#1d4ed8'], ['Atlántico Racing', '#059669'], ['Sierra GP', '#f59e0b'], ['Duero Team', '#7c3aed'],
  ].map(([name, color]) => ({ id: uid(), promoterId: pid, name, color }));
  const names = ['Lucía Ferrer', 'Marc Puig', 'Iker Etxeberria', 'Sara Navarro', 'Diego Ortega', 'Noa Castillo', 'Pablo Ruiz', 'Elena Vidal', 'Hugo Romero', 'Carla Mendes'];
  const nats = ['ES', 'ES', 'ES', 'ES', 'MX', 'AR', 'ES', 'ES', 'CO', 'PT'];
  const drivers: Driver[] = names.map((name, i) => ({ id: uid(), promoterId: pid, name, nationality: nats[i], defaultNumber: [4, 7, 11, 16, 22, 27, 33, 44, 55, 81][i] }));
  next.teams.push(...teams);
  next.drivers.push(...drivers);

  const catPro = { id: uid(), name: 'F-Pro' };
  const catJr = { id: uid(), name: 'F-Junior' };
  const ch = { id: uid(), promoterId: pid, name: 'Campeonato de Monoplazas', discipline: 'Monoplazas', categories: [catPro, catJr] };
  const moto = { id: uid(), promoterId: pid, name: 'Copa de Velocidad Moto', discipline: 'Motos', categories: [{ id: uid(), name: 'Open 600' }] };
  next.championships.push(ch, moto);

  const circuits = ['Jarama', 'Montmeló', 'Jerez', 'Navarra', 'Aragón', 'Valencia', 'Portimão', 'Estoril'];

  const makeSeason = (year: number, catId: string, chId: string, preset: string, done: number, total: number, ds: Driver[]): Season => {
    // "Talento" de cada piloto en esta temporada, para que los resultados tengan algo de lógica
    const skill = drivers.map(() => rand());
    const rounds: Round[] = Array.from({ length: total }, (_, i) => {
      const date = new Date(Date.UTC(year, 2 + i, 8 + ((i * 3) % 14))).toISOString().slice(0, 10);
      const r: Round = { id: uid(), name: `GP de ${circuits[i % circuits.length]}`, location: circuits[i % circuits.length], date, multiplier: i === total - 1 ? 2 : 1, hasSprint: i % 3 === 1 };
      if (i < done) {
        const order = [...ds].map((d) => ({ d, v: skill[drivers.indexOf(d)] + rand() * 0.9 })).sort((a, b) => b.v - a.v).map((x) => x.d.id);
        const dnf = rand() < 0.5 ? order.pop() : undefined;
        r.race = {
          results: [...order.map((driverId) => ({ driverId, status: 'classified' as const })), ...(dnf ? [{ driverId: dnf, status: 'dnf' as const }] : [])],
          poleDriverId: order[Math.floor(rand() * 3)],
          fastestLapDriverId: order[Math.floor(rand() * 5)],
        };
        if (r.hasSprint) {
          const so = [...order].sort(() => rand() - 0.5);
          r.sprint = { results: so.map((driverId) => ({ driverId, status: 'classified' as const })) };
        }
      }
      return r;
    });
    return {
      id: uid(), championshipId: chId, categoryId: catId, name: String(year), year, status: done === total ? 'finished' : done > 0 ? 'running' : 'planned',
      scoring: { ...presetConfig(preset), teamCountBest: 2 },
      entries: ds.map((d, i) => ({ driverId: d.id, teamId: teams[Math.floor(i / 2) % teams.length].id, number: d.defaultNumber })),
      rounds,
    };
  };

  next.seasons.push(
    makeSeason(2024, catPro.id, ch.id, 'f1-2019', 8, 8, drivers.slice(0, 8)),
    makeSeason(2025, catPro.id, ch.id, 'f1-2025', 8, 8, drivers.slice(0, 8)),
    makeSeason(2026, catPro.id, ch.id, 'f1-2025', 5, 8, drivers.slice(0, 8)),
    makeSeason(2025, catJr.id, ch.id, 'club', 6, 6, drivers.slice(4, 10)),
    makeSeason(2025, moto.categories[0].id, moto.id, 'motogp', 7, 7, drivers.slice(2, 10)),
  );
  next.manualTitles.push(
    { id: uid(), promoterId: pid, championshipId: ch.id, categoryId: catPro.id, year: 2023, driverName: 'Álex Moreno', teamName: 'Sierra GP' },
    { id: uid(), promoterId: pid, championshipId: ch.id, categoryId: catPro.id, year: 2022, driverName: 'Lucía Ferrer', teamName: 'Scuderia Tajo' },
  );
  return next;
}
