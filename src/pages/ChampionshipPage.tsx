import { useState } from 'react';
import { Card, Crumbs, Empty, confirmDelete } from '../components/ui';
import { go } from '../lib/router';
import { byId, STATUS_LABEL } from '../lib/selectors';
import { driverStandings, isRoundScored, PRESETS, presetConfig } from '../lib/scoring';
import { uid, update, useDB } from '../lib/store';
import type { Round, Season } from '../lib/model';

export default function ChampionshipPage({ id }: { id: string }) {
  const db = useDB();
  const ch = byId(db.championships, id);
  const [newCat, setNewCat] = useState('');
  const [f, setF] = useState({ cat: '', year: new Date().getFullYear(), preset: 'f1-2025', rounds: 10, sprintEvery: 0, doubleFinal: false, copyEntries: true });
  if (!ch) return <div className="page"><Empty>Campeonato no encontrado.</Empty></div>;
  const p = byId(db.promoters, ch.promoterId)!;
  const catId = f.cat || ch.categories[0]?.id;

  const createSeason = () => {
    if (!catId) return;
    const prev = db.seasons.filter((s) => s.championshipId === ch.id && s.categoryId === catId).sort((a, b) => b.year - a.year)[0];
    const rounds: Round[] = Array.from({ length: f.rounds }, (_, i) => ({
      id: uid(), name: `Ronda ${i + 1}`, multiplier: f.doubleFinal && i === f.rounds - 1 ? 2 : 1,
      hasSprint: f.sprintEvery > 0 && (i + 1) % f.sprintEvery === 0,
    }));
    const season: Season = {
      id: uid(), championshipId: ch.id, categoryId: catId, name: String(f.year), year: f.year, status: 'planned',
      scoring: presetConfig(f.preset),
      entries: f.copyEntries && prev ? structuredClone(prev.entries) : [],
      rounds,
    };
    update((d) => { d.seasons.push(season); });
    go(`s/${season.id}/${season.entries.length ? 'rondas' : 'inscritos'}`);
  };

  return (
    <div className="page">
      <Crumbs items={[[p.name, `p/${p.id}`], [ch.name]]} />
      <h1 className="title" style={{ borderLeftColor: p.color }}>{ch.name} <span className="badge">{ch.discipline}</span></h1>

      <div className="two wide-left">
        <div>
          {ch.categories.map((cat) => {
            const seasons = db.seasons.filter((s) => s.championshipId === ch.id && s.categoryId === cat.id).sort((a, b) => b.year - a.year);
            return (
              <Card key={cat.id} title={<input className="inline h" value={cat.name} onChange={(e) => update((d) => { byId(d.championships, ch.id)!.categories.find((c) => c.id === cat.id)!.name = e.target.value; })} />}
                actions={seasons.length === 0 && ch.categories.length > 1 && <button className="ghost danger" onClick={() => update((d) => { const c = byId(d.championships, ch.id)!; c.categories = c.categories.filter((x) => x.id !== cat.id); })}>Quitar</button>}>
                {seasons.length === 0 ? <Empty>Sin temporadas.</Empty> : (
                  <table>
                    <thead><tr><th>Temporada</th><th>Estado</th><th>Rondas</th><th>Líder / Campeón</th><th></th></tr></thead>
                    <tbody>
                      {seasons.map((s) => {
                        const leader = driverStandings(s)[0];
                        const done = s.rounds.filter(isRoundScored).length;
                        return (
                          <tr key={s.id} onClick={() => go(`s/${s.id}`)}>
                            <td><b>{s.name}</b></td>
                            <td><span className={`badge st-${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                            <td>{done}/{s.rounds.length}</td>
                            <td>{leader && done ? `${s.status === 'finished' ? '🏆 ' : ''}${byId(db.drivers, leader.driverId)?.name} (${leader.points})` : '—'}</td>
                            <td className="right"><button className="ghost danger" onClick={(e) => { e.stopPropagation(); if (confirmDelete(`la temporada ${s.name}`)) update((d) => { d.seasons = d.seasons.filter((x) => x.id !== s.id); }); }}>Borrar</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}
          <Card title="Añadir categoría">
            <div className="form-row">
              <input placeholder="Nombre (p. ej. Moto3)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button onClick={() => { if (newCat.trim()) { update((d) => { byId(d.championships, ch.id)!.categories.push({ id: uid(), name: newCat.trim() }); }); setNewCat(''); } }}>Añadir</button>
            </div>
          </Card>
        </div>

        <Card title="Nueva temporada">
          <div className="form-col">
            <label>Categoría
              <select value={catId} onChange={(e) => setF({ ...f, cat: e.target.value })}>
                {ch.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Año<input type="number" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })} /></label>
            <label>Plantilla de puntuación
              <select value={f.preset} onChange={(e) => setF({ ...f, preset: e.target.value })}>
                {PRESETS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <span className="muted small">{PRESETS.find((x) => x.id === f.preset)?.description} Podrás ajustarla después.</span>
            </label>
            <label>Número de rondas<input type="number" min={1} max={40} value={f.rounds} onChange={(e) => setF({ ...f, rounds: Math.max(1, +e.target.value) })} /></label>
            <label>Sprint
              <select value={f.sprintEvery} onChange={(e) => setF({ ...f, sprintEvery: +e.target.value })}>
                <option value={0}>Sin sprints</option><option value={1}>En todas las rondas</option><option value={2}>Cada 2 rondas</option><option value={3}>Cada 3 rondas</option><option value={4}>Cada 4 rondas</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={f.doubleFinal} onChange={(e) => setF({ ...f, doubleFinal: e.target.checked })} /> Doble puntuación en la última ronda</label>
            <label className="check"><input type="checkbox" checked={f.copyEntries} onChange={(e) => setF({ ...f, copyEntries: e.target.checked })} /> Copiar parrilla de la temporada anterior</label>
            <button onClick={createSeason}>Crear temporada</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
