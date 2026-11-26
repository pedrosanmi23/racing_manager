import { useState } from 'react';
import { Back, Card, Crumbs, Empty, TeamDot } from '../components/ui';
import { byId, categoryName } from '../lib/selectors';
import { scoreDriverRound } from '../lib/scoring';
import { update, useDB } from '../lib/store';
import type { DB, ResultRow, ResultStatus, Round, Season, SessionResult } from '../lib/model';

type Row = { pos: string; status: ResultStatus | '' };

export default function RoundPage({ seasonId, roundId }: { seasonId: string; roundId: string }) {
  const db = useDB();
  const s = byId(db.seasons, seasonId);
  const idx = s?.rounds.findIndex((r) => r.id === roundId) ?? -1;
  if (!s || idx < 0) return <div className="page"><Empty>Ronda no encontrada.</Empty></div>;
  const r = s.rounds[idx];
  const ch = byId(db.championships, s.championshipId)!;
  const p = byId(db.promoters, ch.promoterId)!;
  const setRound = (fn: (x: Round) => void) => update((d) => fn(byId(d.seasons, s.id)!.rounds[idx]));

  return (
    <div className="page">
      <Crumbs items={[[p.name, `p/${p.id}`], [ch.name, `c/${ch.id}`], [`${categoryName(ch, s.categoryId)} ${s.name}`, `s/${s.id}/rondas`], [r.name]]} />
      <div className="title-row">
        <h1 className="title" style={{ borderLeftColor: p.color }}>R{idx + 1} · {r.name}</h1>
        <Back to={`s/${s.id}/clasificacion`}>Ver clasificación</Back>
      </div>
      <Card title="Datos de la ronda">
        <div className="form-row">
          <label>Nombre<input value={r.name} onChange={(e) => setRound((x) => { x.name = e.target.value; })} /></label>
          <label>Circuito<input value={r.location ?? ''} onChange={(e) => setRound((x) => { x.location = e.target.value; })} /></label>
          <label>Fecha<input type="date" value={r.date ?? ''} onChange={(e) => setRound((x) => { x.date = e.target.value || undefined; })} /></label>
          <label>Multiplicador
            <select value={r.multiplier} onChange={(e) => setRound((x) => { x.multiplier = +e.target.value; })}>
              <option value={1}>Normal (x1)</option><option value={2}>Doble puntuación (x2)</option><option value={1.5}>x1,5</option><option value={0.5}>Mitad de puntos (x0,5)</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={r.hasSprint} onChange={(e) => setRound((x) => { x.hasSprint = e.target.checked; })} /> Tiene sprint</label>
        </div>
      </Card>
      {s.entries.length === 0 && <Empty>Inscribe pilotos en la parrilla de la temporada antes de meter resultados.</Empty>}
      {s.entries.length > 0 && (
        <div className={r.hasSprint ? 'two' : ''}>
          {r.hasSprint && <SessionEditor key={'s' + r.id} title="Sprint" db={db} s={s} session={r.sprint} onSave={(v) => setRound((x) => { x.sprint = v; })} />}
          <SessionEditor key={'r' + r.id} title="Carrera" db={db} s={s} session={r.race} onSave={(v) => setRound((x) => { x.race = v; })} />
        </div>
      )}
      {r.race && r.race.results.length > 0 && <RoundPoints db={db} s={s} r={r} />}
    </div>
  );
}

function toRows(s: Season, session?: SessionResult): Record<string, Row> {
  const rows: Record<string, Row> = {};
  s.entries.forEach((e) => (rows[e.driverId] = { pos: '', status: '' }));
  let pos = 0;
  session?.results.forEach((x) => {
    rows[x.driverId] = x.status === 'classified' ? { pos: String(++pos), status: 'classified' } : { pos: '', status: x.status };
  });
  return rows;
}

function SessionEditor({ title, db, s, session, onSave }: { title: string; db: DB; s: Season; session?: SessionResult; onSave: (v: SessionResult | undefined) => void }) {
  const [rows, setRows] = useState(() => toRows(s, session));
  const [pole, setPole] = useState(session?.poleDriverId ?? '');
  const [fl, setFl] = useState(session?.fastestLapDriverId ?? '');
  const [quick, setQuick] = useState('');
  const [msg, setMsg] = useState('');
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const entries = [...s.entries].sort((a, b) => {
    const pa = +rows[a.driverId]?.pos || 999, pb = +rows[b.driverId]?.pos || 999;
    return pa - pb;
  });

  const save = () => {
    const classified = Object.entries(rows).filter(([, v]) => v.pos).sort((a, b) => +a[1].pos - +b[1].pos);
    const dup = classified.find(([, v], i) => i > 0 && v.pos === classified[i - 1][1].pos);
    if (dup) { setMsg(`Posición ${dup[1].pos} repetida.`); return; }
    const results: ResultRow[] = [
      ...classified.map(([driverId]) => ({ driverId, status: 'classified' as const })),
      ...Object.entries(rows).filter(([, v]) => !v.pos && v.status && v.status !== 'classified').map(([driverId, v]) => ({ driverId, status: v.status as ResultStatus })),
    ];
    onSave(results.length ? { results, poleDriverId: pole || undefined, fastestLapDriverId: fl || undefined } : undefined);
    setMsg('Guardado ✓');
    setTimeout(() => setMsg(''), 1500);
  };

  /** Entrada rápida: dorsales en orden de llegada, p. ej. "44 7 11 16". */
  const applyQuick = () => {
    const nums = quick.split(/[\s,;]+/).filter(Boolean);
    const next: Record<string, Row> = {};
    s.entries.forEach((e) => (next[e.driverId] = { pos: '', status: '' }));
    const missing: string[] = [];
    nums.forEach((n, i) => {
      const e = s.entries.find((x) => String(x.number) === n);
      if (e) next[e.driverId] = { pos: String(i + 1), status: 'classified' };
      else missing.push(n);
    });
    setRows(next);
    setMsg(missing.length ? `Dorsales no encontrados: ${missing.join(', ')}` : 'Orden aplicado. Revisa y guarda.');
  };

  return (
    <Card title={title} actions={<><span className="muted small">{msg}</span> <button onClick={save}>Guardar {title.toLowerCase()}</button></>}>
      <div className="form-row">
        <input placeholder="Entrada rápida: dorsales en orden de llegada (44 7 11 …)" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyQuick()} />
        <button className="secondary" onClick={applyQuick}>Aplicar</button>
        <button className="ghost" onClick={() => setRows(Object.fromEntries(s.entries.map((e, i) => [e.driverId, { pos: String(i + 1), status: 'classified' as const }])))}>Orden de parrilla</button>
        <button className="ghost danger" onClick={() => setRows(toRows(s))}>Vaciar</button>
      </div>
      <table className="results">
        <thead><tr><th style={{ width: 70 }}>Pos</th><th>#</th><th>Piloto</th><th>Estado</th></tr></thead>
        <tbody>
          {entries.map((e) => {
            const row = rows[e.driverId] ?? { pos: '', status: '' };
            const team = byId(db.teams, e.teamId);
            return (
              <tr key={e.driverId} className={row.pos ? '' : 'muted'}>
                <td><input className="inline" type="number" min={1} value={row.pos} onChange={(ev) => set(e.driverId, { pos: ev.target.value, status: ev.target.value ? 'classified' : '' })} /></td>
                <td>{e.number}</td>
                <td><TeamDot color={team?.color} /> {byId(db.drivers, e.driverId)?.name}</td>
                <td>
                  <select value={row.pos ? 'classified' : row.status} onChange={(ev) => set(e.driverId, { status: ev.target.value as ResultStatus, pos: ev.target.value === 'classified' ? row.pos : '' })}>
                    <option value="">No participa</option>
                    <option value="classified">Clasificado</option>
                    <option value="dnf">Abandono (DNF)</option>
                    <option value="dns">No sale (DNS)</option>
                    <option value="dsq">Descalificado (DSQ)</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="form-row">
        <label>Pole
          <select value={pole} onChange={(e) => setPole(e.target.value)}>
            <option value="">—</option>
            {s.entries.map((e) => <option key={e.driverId} value={e.driverId}>{byId(db.drivers, e.driverId)?.name}</option>)}
          </select>
        </label>
        {title === 'Carrera' && (
          <label>Vuelta rápida
            <select value={fl} onChange={(e) => setFl(e.target.value)}>
              <option value="">—</option>
              {s.entries.map((e) => <option key={e.driverId} value={e.driverId}>{byId(db.drivers, e.driverId)?.name}</option>)}
            </select>
          </label>
        )}
      </div>
    </Card>
  );
}

function RoundPoints({ db, s, r }: { db: DB; s: Season; r: Round }) {
  const rows = s.entries.map((e) => ({ e, sc: scoreDriverRound(r, e.driverId, s.scoring) })).filter((x) => x.sc.participated).sort((a, b) => b.sc.points - a.sc.points);
  return (
    <Card title="Puntos obtenidos en esta ronda">
      <table>
        <thead><tr><th>Piloto</th><th>Carrera</th>{r.hasSprint && <th>Sprint</th>}<th>Extras</th><th>Puntos</th></tr></thead>
        <tbody>
          {rows.map(({ e, sc }) => (
            <tr key={e.driverId}>
              <td>{byId(db.drivers, e.driverId)?.name}</td>
              <td>{sc.racePos ? `P${sc.racePos}` : sc.raceStatus?.toUpperCase() ?? '—'}</td>
              {r.hasSprint && <td>{sc.sprintPos ? `P${sc.sprintPos}` : '—'}</td>}
              <td>{[sc.pole && 'Pole', sc.fastestLap && 'V. rápida'].filter(Boolean).join(' · ')}</td>
              <td><b>{sc.points}</b>{r.multiplier !== 1 && <span className="muted small"> (x{r.multiplier})</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
