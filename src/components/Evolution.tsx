import { useEffect, useMemo, useRef, useState } from 'react';
import type { DB, Season } from '../lib/model';
import { byId } from '../lib/selectors';
import { driverStandings, isRoundScored } from '../lib/scoring';
import { Empty } from './ui';

// Paleta categórica validada para la superficie oscura (#171a21): orden fijo, nunca cíclica.
const SLOTS = ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'];
const MAX = SLOTS.length;

type Mode = 'points' | 'position';

export default function Evolution({ db, s }: { db: DB; s: Season }) {
  const scored = s.rounds.filter(isRoundScored);
  const final = useMemo(() => driverStandings(s), [s]);

  // Puntos acumulados y posición en el campeonato tras cada ronda
  const series = useMemo(() => {
    const byDriver = new Map<string, { points: number[]; position: number[] }>();
    final.forEach((d) => byDriver.set(d.driverId, { points: [], position: [] }));
    scored.forEach((_, i) => {
      const partial = { ...s, rounds: scored.slice(0, i + 1) };
      driverStandings(partial).forEach((d) => {
        const row = byDriver.get(d.driverId);
        if (!row) return;
        row.points.push(d.rounds.reduce((sum, r) => sum + r.points, 0));
        row.position.push(d.position);
      });
    });
    return byDriver;
  }, [s, scored, final]);

  // Color por piloto, asignado al seleccionarlo y estable mientras siga seleccionado
  const [colorOf, setColorOf] = useState<Record<string, number>>(() =>
    Object.fromEntries(final.slice(0, 5).map((d, i) => [d.driverId, i])));
  const [mode, setMode] = useState<Mode>('points');
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(900);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  if (scored.length === 0) return <Empty>La evolución aparece en cuanto haya resultados.</Empty>;

  const selected = final.filter((d) => colorOf[d.driverId] != null);
  const name = (id: string) => byId(db.drivers, id)?.name ?? '?';
  const toggle = (id: string) => setColorOf((c) => {
    const next = { ...c };
    if (next[id] != null) { delete next[id]; return next; }
    const used = new Set(Object.values(next));
    const free = SLOTS.findIndex((_, i) => !used.has(i));
    if (free < 0) return c;
    next[id] = free;
    return next;
  });

  // Geometría
  const H = 380, m = { t: 16, r: selected.length <= 4 ? 130 : 24, b: 36, l: 44 };
  const iw = width - m.l - m.r, ih = H - m.t - m.b;
  const n = scored.length;
  const x = (i: number) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const vals = selected.flatMap((d) => series.get(d.driverId)![mode]);
  const maxPts = Math.max(10, ...vals);
  const step = niceStep(maxPts / 5);
  const yMax = mode === 'points' ? Math.ceil(maxPts / step) * step : final.length;
  const y = (v: number) => mode === 'points' ? m.t + ih - (v / yMax) * ih : m.t + ((v - 1) / Math.max(1, yMax - 1)) * ih;
  const ticks = mode === 'points'
    ? Array.from({ length: yMax / step + 1 }, (_, i) => i * step)
    : Array.from({ length: final.length }, (_, i) => i + 1).filter((p) => final.length <= 12 || p === 1 || p % 5 === 0);

  // Etiquetas directas al final de la línea, separadas para que no se pisen
  const ends = selected.map((d) => ({ id: d.driverId, y: y(series.get(d.driverId)![mode][n - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const label = (r: (typeof scored)[number]) => (r.location ?? r.name).slice(0, 3).toUpperCase();

  return (
    <div className="evo">
      <div className="form-row evo-controls">
        <div className="seg">
          <button className={mode === 'points' ? 'on' : ''} onClick={() => setMode('points')}>Puntos acumulados</button>
          <button className={mode === 'position' ? 'on' : ''} onClick={() => setMode('position')}>Posición en el campeonato</button>
        </div>
        <button className="ghost" onClick={() => setAsTable(!asTable)}>{asTable ? 'Ver gráfico' : 'Ver como tabla'}</button>
      </div>
      <div className="chips" role="group" aria-label="Pilotos mostrados">
        {final.map((d) => {
          const c = colorOf[d.driverId];
          const full = c == null && selected.length >= MAX;
          return (
            <button key={d.driverId} className={`chip ${c != null ? 'on' : ''}`} disabled={full} onClick={() => toggle(d.driverId)}
              title={full ? `Máximo ${MAX} pilotos a la vez` : undefined}>
              <span className="sw" style={{ background: c != null ? SLOTS[c] : 'transparent' }} />
              {d.position}. {name(d.driverId)}
            </button>
          );
        })}
      </div>

      {asTable ? (
        <div className="scroll">
          <table className="standings">
            <thead><tr><th>Piloto</th>{scored.map((r) => <th key={r.id} className="rcol" title={r.name}>{label(r)}</th>)}</tr></thead>
            <tbody>
              {final.map((d) => (
                <tr key={d.driverId}>
                  <td>{name(d.driverId)}</td>
                  {series.get(d.driverId)![mode].map((v, i) => <td key={i} className="num">{mode === 'position' ? `P${v}` : v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={box} className="chart" onMouseLeave={() => setHover(null)}>
          <svg width={width} height={H} role="img" aria-label={`Evolución de ${mode === 'points' ? 'puntos' : 'posiciones'} por ronda`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} className="grid" />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="axis">{mode === 'position' ? `P${t}` : t}</text>
              </g>
            ))}
            {scored.map((r, i) => <text key={r.id} x={x(i)} y={H - 12} textAnchor="middle" className={`axis ${hover === i ? 'hl' : ''}`}>{label(r)}</text>)}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} className="crosshair" />}
            {selected.map((d) => {
              const v = series.get(d.driverId)![mode];
              const col = SLOTS[colorOf[d.driverId]];
              return (
                <g key={d.driverId}>
                  <polyline fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={v.map((p, i) => `${x(i)},${y(p)}`).join(' ')} />
                  {hover != null && <circle cx={x(hover)} cy={y(v[hover])} r={4.5} fill={col} stroke="#171a21" strokeWidth={2} />}
                </g>
              );
            })}
            {selected.length <= 4 && ends.map((e) => (
              <text key={e.id} x={m.l + iw + 8} y={e.y + 4} className="endlabel">{name(e.id)}</text>
            ))}
            {/* Zonas de hover por ronda: más grandes que la marca */}
            {scored.map((r, i) => {
              const half = n === 1 ? iw / 2 : iw / (n - 1) / 2;
              return <rect key={r.id} x={x(i) - half} y={m.t} width={half * 2} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />;
            })}
          </svg>
          {hover != null && selected.length > 0 && (
            <div className="tooltip" style={{ left: Math.min(x(hover) + 12, width - 220), top: m.t }}>
              <b>R{s.rounds.indexOf(scored[hover]) + 1} · {scored[hover].name}</b>
              {[...selected].sort((a, b) => {
                const va = series.get(a.driverId)![mode][hover], vb = series.get(b.driverId)![mode][hover];
                return mode === 'points' ? vb - va : va - vb;
              }).map((d) => (
                <div key={d.driverId} className="tt-row">
                  <span className="sw" style={{ background: SLOTS[colorOf[d.driverId]] }} />
                  <span>{name(d.driverId)}</span>
                  <b>{mode === 'position' ? 'P' : ''}{series.get(d.driverId)![mode][hover]}{mode === 'points' ? ' pts' : ''}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {mode === 'points' && s.scoring.dropWorst > 0 && <p className="muted small">Puntos brutos acumulados (los descartes solo se aplican a la clasificación final).</p>}
    </div>
  );
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
