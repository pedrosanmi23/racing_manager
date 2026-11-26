import { useState } from 'react';
import Evolution from '../components/Evolution';
import ImportCSV from '../components/ImportCSV';
import { Card, Crumbs, Empty, PosCell, Tabs, TeamDot } from '../components/ui';
import { go } from '../lib/router';
import { byId, categoryName, fmtDate, STATUS_LABEL } from '../lib/selectors';
import { driverStandings, isMathematicallyDecided, isRoundScored, maxPointsRemaining, PRESETS, presetConfig, teamStandings } from '../lib/scoring';
import { uid, update, useDB } from '../lib/store';
import type { DB, ScoringConfig, Season, SeasonStatus } from '../lib/model';

const TABS: [string, string][] = [['clasificacion', 'Pilotos'], ['evolucion', 'Evolución'], ['equipos', 'Equipos'], ['rondas', 'Calendario y resultados'], ['inscritos', 'Parrilla'], ['reglamento', 'Reglamento']];

const mut = (id: string, fn: (s: Season) => void) => update((d) => fn(byId(d.seasons, id)!));

export default function SeasonPage({ id, tab }: { id: string; tab: string }) {
  const db = useDB();
  const s = byId(db.seasons, id);
  if (!s) return <div className="page"><Empty>Temporada no encontrada.</Empty></div>;
  const ch = byId(db.championships, s.championshipId)!;
  const p = byId(db.promoters, ch.promoterId)!;
  return (
    <div className="page">
      <Crumbs items={[[p.name, `p/${p.id}`], [ch.name, `c/${ch.id}`], [`${categoryName(ch, s.categoryId)} ${s.name}`]]} />
      <div className="title-row">
        <h1 className="title" style={{ borderLeftColor: p.color }}>{categoryName(ch, s.categoryId)} · {s.name}</h1>
        <select value={s.status} onChange={(e) => mut(s.id, (x) => { x.status = e.target.value as SeasonStatus; })} className={`st-${s.status}`}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Tabs tabs={TABS} active={tab} base={`s/${id}`} />
      {tab === 'clasificacion' && <DriversTable db={db} s={s} />}
      {tab === 'evolucion' && <Card><Evolution db={db} s={s} /></Card>}
      {tab === 'equipos' && <TeamsTable db={db} s={s} />}
      {tab === 'rondas' && <Rounds db={db} s={s} />}
      {tab === 'inscritos' && <Entries db={db} s={s} promoterId={p.id} />}
      {tab === 'reglamento' && <Rules s={s} />}
    </div>
  );
}

function DriversTable({ db, s }: { db: DB; s: Season }) {
  const st = driverStandings(s);
  const scored = s.rounds.filter(isRoundScored);
  const entry = new Map(s.entries.map((e) => [e.driverId, e]));
  const decided = isMathematicallyDecided(s, st);
  const remaining = maxPointsRemaining(s);
  if (!scored.length) return <Empty>Todavía no hay resultados. Ve a «Calendario y resultados» para introducir la primera carrera.</Empty>;
  return (
    <>
      {s.status !== 'finished' && st[0] && (
        <div className={`banner ${decided ? 'gold' : ''}`}>
          {decided
            ? <>🏆 <b>{byId(db.drivers, st[0].driverId)?.name}</b> es campeón matemático. Marca la temporada como «Finalizada» para pasarlo al palmarés.</>
            : <>Quedan <b>{remaining}</b> puntos en juego · ventaja del líder: <b>{st[0].points - (st[1]?.points ?? 0)}</b></>}
        </div>
      )}
      <Card>
        <div className="scroll">
          <table className="standings">
            <thead>
              <tr><th>Pos</th><th>#</th><th>Piloto</th><th>Equipo</th>
                {scored.map((r) => <th key={r.id} title={r.name} className="rcol">{(r.location ?? r.name).slice(0, 3).toUpperCase()}{r.multiplier !== 1 && <sup>x{r.multiplier}</sup>}</th>)}
                <th>Pts</th><th>Dif</th><th>V</th><th>Pod</th><th>Pole</th></tr>
            </thead>
            <tbody>
              {st.map((d) => {
                const e = entry.get(d.driverId);
                const team = byId(db.teams, e?.teamId);
                return (
                  <tr key={d.driverId}>
                    <td><b>{d.tiedWithPrev ? '=' : ''}{d.position}</b></td>
                    <td className="muted">{e?.number}</td>
                    <td><b>{byId(db.drivers, d.driverId)?.name}</b></td>
                    <td><TeamDot color={team?.color} /> {team?.name ?? '—'}</td>
                    {d.rounds.map((r) => <PosCell key={r.roundId} pos={r.racePos} status={r.raceStatus} dropped={r.dropped} extra={[r.pole && 'P', r.fastestLap && 'VR'].filter(Boolean).join(' ')} />)}
                    <td><b>{d.points}</b>{d.points !== d.grossPoints && <span className="muted small"> ({d.grossPoints})</span>}</td>
                    <td className="muted">{d.position === 1 ? '' : `-${st[0].points - d.points}`}</td>
                    <td>{d.wins}</td><td>{d.podiums}</td><td>{d.poles}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">P = pole · VR = vuelta rápida · tachado = resultado descartado · entre paréntesis, puntos brutos antes de descartes.</p>
      </Card>
    </>
  );
}

function TeamsTable({ db, s }: { db: DB; s: Season }) {
  const ts = teamStandings(s);
  const scored = s.rounds.filter(isRoundScored);
  const promoterId = byId(db.championships, s.championshipId)!.promoterId;
  if (!ts.length) return (
    <Card title="Equipos">
      <Empty>Ningún piloto de esta temporada tiene equipo todavía. Crea los equipos aquí y asígnalos a cada piloto en «Parrilla».</Empty>
      <NewTeamForm promoterId={promoterId} onCreated={() => go(`s/${s.id}/inscritos`)} />
    </Card>
  );
  return (
    <Card title={`Clasificación de equipos${s.scoring.teamCountBest ? ` (puntúan los ${s.scoring.teamCountBest} mejores pilotos por ronda)` : ''}`}>
      <div className="scroll">
        <table className="standings">
          <thead><tr><th>Pos</th><th>Equipo</th>{scored.map((r) => <th key={r.id} className="rcol" title={r.name}>{(r.location ?? r.name).slice(0, 3).toUpperCase()}</th>)}<th>Pts</th><th>V</th><th>Pod</th></tr></thead>
          <tbody>
            {ts.map((t) => {
              const team = byId(db.teams, t.teamId);
              const max = ts[0].points || 1;
              return (
                <tr key={t.teamId}>
                  <td><b>{t.position}</b></td>
                  <td><TeamDot color={team?.color} /> <b>{team?.name}</b><div className="bar" style={{ width: `${(t.points / max) * 100}%`, background: team?.color }} /></td>
                  {t.rounds.map((r) => <td key={r.roundId} className={`num ${r.dropped ? 'dropped' : ''}`}>{r.points}</td>)}
                  <td><b>{t.points}</b></td><td>{t.wins}</td><td>{t.podiums}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Rounds({ db, s }: { db: DB; s: Season }) {
  return (
    <Card title={`Rondas (${s.rounds.length})`} actions={<button onClick={() => mut(s.id, (x) => { x.rounds.push({ id: uid(), name: `Ronda ${x.rounds.length + 1}`, multiplier: 1, hasSprint: false }); })}>+ Añadir ronda</button>}>
      <table>
        <thead><tr><th>R</th><th>Nombre</th><th>Circuito</th><th>Fecha</th><th>Formato</th><th>Ganador</th><th></th></tr></thead>
        <tbody>
          {s.rounds.map((r, i) => {
            const w = r.race?.results.find((x) => x.status === 'classified');
            return (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td><input className="inline" value={r.name} onChange={(e) => mut(s.id, (x) => { x.rounds[i].name = e.target.value; })} /></td>
                <td><input className="inline" placeholder="Circuito" value={r.location ?? ''} onChange={(e) => mut(s.id, (x) => { x.rounds[i].location = e.target.value; })} /></td>
                <td><input className="inline" type="date" value={r.date ?? ''} onChange={(e) => mut(s.id, (x) => { x.rounds[i].date = e.target.value || undefined; })} title={fmtDate(r.date)} /></td>
                <td>{r.hasSprint && <span className="badge">Sprint</span>} {r.multiplier !== 1 && <span className="badge gold">x{r.multiplier}</span>}</td>
                <td>{w ? <>🏁 {byId(db.drivers, w.driverId)?.name}</> : <span className="muted">Pendiente</span>}</td>
                <td className="right nowrap">
                  <button className="ghost" disabled={i === 0} onClick={() => mut(s.id, (x) => { [x.rounds[i - 1], x.rounds[i]] = [x.rounds[i], x.rounds[i - 1]]; })}>↑</button>
                  <button className="ghost" disabled={i === s.rounds.length - 1} onClick={() => mut(s.id, (x) => { [x.rounds[i + 1], x.rounds[i]] = [x.rounds[i], x.rounds[i + 1]]; })}>↓</button>
                  <button onClick={() => go(`s/${s.id}/r/${r.id}`)}>Resultados</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Entries({ db, s, promoterId }: { db: DB; s: Season; promoterId: string }) {
  const drivers = db.drivers.filter((d) => d.promoterId === promoterId);
  const teams = db.teams.filter((t) => t.promoterId === promoterId);
  const free = drivers.filter((d) => !s.entries.some((e) => e.driverId === d.id));
  const [newName, setNewName] = useState('');
  const [newTeamFor, setNewTeamFor] = useState<string | null>(null);
  return (
    <Card title={`Parrilla (${s.entries.length} pilotos)`} actions={free.length > 0 && <button className="secondary" onClick={() => mut(s.id, (x) => { free.forEach((d) => x.entries.push({ driverId: d.id, number: d.defaultNumber })); })}>Inscribir a todos</button>}>
      <table>
        <thead><tr><th>Dorsal</th><th>Piloto</th><th>Equipo</th><th></th></tr></thead>
        <tbody>
          {s.entries.map((e, i) => (
            <tr key={e.driverId}>
              <td style={{ width: 90 }}><input className="inline" type="number" value={e.number ?? ''} onChange={(ev) => mut(s.id, (x) => { x.entries[i].number = ev.target.value ? +ev.target.value : undefined; })} /></td>
              <td>{byId(db.drivers, e.driverId)?.name}</td>
              <td>
                <TeamDot color={byId(teams, e.teamId)?.color} />{' '}
                <select value={e.teamId ?? ''} onChange={(ev) => {
                  if (ev.target.value === '__new') { setNewTeamFor(e.driverId); return; }
                  mut(s.id, (x) => { x.entries[i].teamId = ev.target.value || undefined; });
                }}>
                  <option value="">— Sin equipo —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value="__new">+ Crear equipo nuevo…</option>
                </select>
                {newTeamFor === e.driverId && (
                  <NewTeamForm promoterId={promoterId} onCreated={(teamId) => { mut(s.id, (x) => { x.entries[i].teamId = teamId; }); setNewTeamFor(null); }} />
                )}
              </td>
              <td className="right"><button className="ghost danger" onClick={() => mut(s.id, (x) => { x.entries.splice(i, 1); })}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form-row">
        <select value="" onChange={(e) => { const d = byId(db.drivers, e.target.value); if (d) mut(s.id, (x) => { x.entries.push({ driverId: d.id, number: d.defaultNumber }); }); }}>
          <option value="">+ Inscribir piloto existente…</option>
          {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input placeholder="…o crear piloto nuevo" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={() => {
          if (!newName.trim()) return;
          const id = uid();
          update((d) => { d.drivers.push({ id, promoterId, name: newName.trim() }); byId(d.seasons, s.id)!.entries.push({ driverId: id }); });
          setNewName('');
        }}>Crear e inscribir</button>
      </div>
      <ImportCSV kind="drivers" promoterId={promoterId} seasonId={s.id} />
      <p className="muted small">El CSV puede llevar las columnas Nombre, Nacionalidad, Dorsal y Equipo. Los pilotos y equipos que no existan se crean y todos quedan inscritos en esta temporada.</p>
      <h4 className="subhead">Equipos ({teams.length})</h4>
      {teams.length > 0 && <p className="muted small">{teams.map((t) => t.name).join(' · ')}</p>}
      <NewTeamForm promoterId={promoterId} />
      <p className="muted small">Los equipos se guardan en la promotora, así que podrás reutilizarlos en otras temporadas y campeonatos.</p>
    </Card>
  );
}

const TEAM_COLORS = ['#e10600', '#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#ec4899', '#0891b2', '#f97316', '#64748b', '#84cc16'];

/** Crear un equipo de la promotora sin salir de la temporada; opcionalmente asignarlo a un piloto. */
function NewTeamForm({ promoterId, onCreated }: { promoterId: string; onCreated?: (teamId: string) => void }) {
  const [name, setName] = useState('');
  const count = useDB().teams.filter((t) => t.promoterId === promoterId).length;
  const [picked, setColor] = useState<string | null>(null);
  // Si no eliges color, cada equipo nuevo recibe uno distinto
  const color = picked ?? TEAM_COLORS[count % TEAM_COLORS.length];
  const add = () => {
    if (!name.trim()) return;
    const id = uid();
    update((d) => { d.teams.push({ id, promoterId, name: name.trim(), color }); });
    setName(''); setColor(null);
    onCreated?.(id);
  };
  return (
    <div className="form-row">
      <input placeholder="Nombre del nuevo equipo" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color del equipo" />
      <button onClick={add}>Crear equipo</button>
    </div>
  );
}

const parseList = (v: string) => v.split(/[,\s-]+/).map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));

function Rules({ s }: { s: Season }) {
  const c = s.scoring;
  const set = (patch: Partial<ScoringConfig>) => mut(s.id, (x) => { Object.assign(x.scoring, patch, { presetId: undefined }); });
  const [race, setRace] = useState(c.racePoints.join(', '));
  const [sprint, setSprint] = useState(c.sprintPoints.join(', '));
  const num = (k: keyof ScoringConfig, label: string, hint?: string) => (
    <label>{label}<input type="number" value={c[k] as number} onChange={(e) => set({ [k]: +e.target.value })} />{hint && <span className="muted small">{hint}</span>}</label>
  );
  return (
    <div className="two">
      <Card title="Sistema de puntuación">
        <div className="form-col">
          <label>Aplicar plantilla
            <select value={c.presetId ?? ''} onChange={(e) => {
              if (!e.target.value) return;
              const cfg = presetConfig(e.target.value);
              mut(s.id, (x) => { x.scoring = cfg; });
              setRace(cfg.racePoints.join(', ')); setSprint(cfg.sprintPoints.join(', '));
            }}>
              <option value="">Personalizado</option>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Puntos de carrera (de P1 en adelante)
            <input value={race} onChange={(e) => setRace(e.target.value)} onBlur={() => set({ racePoints: parseList(race) })} />
          </label>
          <label>Puntos de sprint
            <input value={sprint} onChange={(e) => setSprint(e.target.value)} onBlur={() => set({ sprintPoints: parseList(sprint) })} placeholder="Vacío si no hay sprint" />
          </label>
          <div className="grid3">
            {num('polePoints', 'Pole (carrera)')}
            {num('sprintPolePoints', 'Pole (sprint)')}
            {num('finishBonus', 'Por terminar', 'Bonus por acabar clasificado')}
            {num('fastestLapPoints', 'Vuelta rápida')}
            <label>VR solo si acaba en top…<input type="number" value={c.fastestLapTopN ?? ''} placeholder="Siempre" onChange={(e) => set({ fastestLapTopN: e.target.value ? +e.target.value : null })} /></label>
          </div>
        </div>
      </Card>
      <Card title="Descartes, desempates y equipos">
        <div className="form-col">
          {num('dropWorst', 'Descartar los N peores resultados', 'Se descartan rondas completas (también las ausencias).')}
          <label className="check"><input type="checkbox" checked={c.dropOnlyIfNotDsq} onChange={(e) => set({ dropOnlyIfNotDsq: e.target.checked })} /> Una descalificación no se puede descartar</label>
          <label>Desempate
            <select value={c.tiebreak} onChange={(e) => set({ tiebreak: e.target.value as ScoringConfig['tiebreak'] })}>
              <option value="countback">Más victorias, luego más 2º puestos… (F1 / MotoGP)</option>
              <option value="lastRace">Mejor resultado en la última carrera</option>
            </select>
          </label>
          {num('teamCountBest', 'Pilotos que puntúan por equipo en cada ronda', '0 = todos los pilotos del equipo')}
          <label className="check"><input type="checkbox" checked={c.teamDropsApply} onChange={(e) => set({ teamDropsApply: e.target.checked })} /> Aplicar descartes también a equipos</label>
          <p className="muted small">El multiplicador de puntos (doble puntuación) y el formato sprint se configuran en cada ronda.</p>
        </div>
      </Card>
      <Card title="Vista previa de la tabla">
        <div className="points-preview">
          {c.racePoints.map((p, i) => <div key={i}><span>P{i + 1}</span><b>{p}</b>{c.sprintPoints[i] != null && <small>{c.sprintPoints[i]}</small>}</div>)}
        </div>
        <p className="muted small">Número grande: carrera · pequeño: sprint.</p>
      </Card>
    </div>
  );
}
