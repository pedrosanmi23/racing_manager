import { useState } from 'react';
import { Card, Crumbs, Empty, Tabs, TeamDot, confirmDelete } from '../components/ui';
import { go } from '../lib/router';
import { byId, careerStats, categoryName, fmtDate, seasonsOfPromoter, STATUS_LABEL, titles } from '../lib/selectors';
import { isRoundScored } from '../lib/scoring';
import { uid, update, useDB } from '../lib/store';
import type { DB, Promoter } from '../lib/model';

const TABS: [string, string][] = [
  ['campeonatos', 'Campeonatos'], ['calendario', 'Calendario'], ['palmares', 'Palmarés'], ['estadisticas', 'Estadísticas'],
  ['pilotos', 'Pilotos'], ['equipos', 'Equipos'], ['ajustes', 'Ajustes'],
];

export default function PromoterPage({ id, tab }: { id: string; tab: string }) {
  const db = useDB();
  const p = byId(db.promoters, id);
  if (!p) return <div className="page"><Empty>Promotora no encontrada.</Empty></div>;
  return (
    <div className="page">
      <Crumbs items={[[p.name]]} />
      <h1 className="title" style={{ borderLeftColor: p.color }}>{p.name}</h1>
      <Tabs tabs={TABS} active={tab} base={`p/${id}`} />
      {tab === 'campeonatos' && <Championships db={db} p={p} />}
      {tab === 'calendario' && <Calendar db={db} p={p} />}
      {tab === 'palmares' && <Palmares db={db} p={p} />}
      {tab === 'estadisticas' && <Stats db={db} p={p} />}
      {tab === 'pilotos' && <Drivers db={db} p={p} />}
      {tab === 'equipos' && <Teams db={db} p={p} />}
      {tab === 'ajustes' && <Settings p={p} />}
    </div>
  );
}

function Championships({ db, p }: { db: DB; p: Promoter }) {
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('Monoplazas');
  const [cats, setCats] = useState('');
  const chs = db.championships.filter((c) => c.promoterId === p.id);
  const create = () => {
    if (!name.trim()) return;
    const id = uid();
    const categories = (cats.trim() ? cats.split(',') : ['General']).map((n) => ({ id: uid(), name: n.trim() })).filter((c) => c.name);
    update((d) => { d.championships.push({ id, promoterId: p.id, name: name.trim(), discipline, categories }); });
    go(`c/${id}`);
  };
  return (
    <>
      <div className="grid">
        {chs.map((c) => {
          const ss = db.seasons.filter((s) => s.championshipId === c.id).sort((a, b) => b.year - a.year);
          return (
            <a key={c.id} className="tile" href={`#/c/${c.id}`} style={{ borderTopColor: p.color }}>
              <span className="badge">{c.discipline}</span>
              <h2>{c.name}</h2>
              <p className="muted">{c.categories.map((k) => k.name).join(' · ')}</p>
              <div className="stats"><span><b>{ss.length}</b> temporadas</span>{ss[0] && <span>Última: {ss[0].year} ({STATUS_LABEL[ss[0].status]})</span>}</div>
            </a>
          );
        })}
        {chs.length === 0 && <Empty>Aún no hay campeonatos en esta promotora.</Empty>}
      </div>
      <Card title="Nuevo campeonato">
        <div className="form-row">
          <input placeholder="Nombre (p. ej. Mundial de Velocidad)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            {['Monoplazas', 'Motos', 'Turismos / GT', 'Resistencia', 'Karting', 'Rally', 'Simracing', 'Otro'].map((x) => <option key={x}>{x}</option>)}
          </select>
          <input placeholder="Categorías separadas por comas (MotoGP, Moto2, Moto3)" value={cats} onChange={(e) => setCats(e.target.value)} style={{ flex: 2 }} />
          <button onClick={create}>Crear</button>
        </div>
      </Card>
    </>
  );
}

function Calendar({ db, p }: { db: DB; p: Promoter }) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = seasonsOfPromoter(db, p.id).flatMap((s) => {
    const ch = byId(db.championships, s.championshipId);
    return s.rounds.map((r, i) => ({ s, r, i, ch }));
  }).filter((x) => x.r.date).sort((a, b) => a.r.date!.localeCompare(b.r.date!));
  const upcoming = rows.filter((x) => !isRoundScored(x.r) && x.r.date! >= today);
  const shown = rows.filter((x) => x.r.date!.slice(0, 4) >= String(new Date().getFullYear() - 1));
  return (
    <>
      {upcoming[0] && (
        <div className="next-event">
          <span className="muted">Próxima ronda</span>
          <h2>{upcoming[0].r.name}</h2>
          <p>{fmtDate(upcoming[0].r.date)} · {upcoming[0].ch?.name} · {categoryName(upcoming[0].ch, upcoming[0].s.categoryId)}</p>
        </div>
      )}
      <Card title="Calendario">
        {shown.length === 0 ? <Empty>No hay rondas con fecha.</Empty> : (
          <table>
            <thead><tr><th>Fecha</th><th>Ronda</th><th>Campeonato</th><th>Categoría</th><th>Ganador</th></tr></thead>
            <tbody>
              {shown.map(({ s, r, i, ch }) => {
                const winner = r.race?.results.find((x) => x.status === 'classified');
                return (
                  <tr key={r.id} className={r.date! < today ? 'past' : ''} onClick={() => go(`s/${s.id}/r/${r.id}`)}>
                    <td>{fmtDate(r.date)}</td>
                    <td>R{i + 1} · {r.name} {r.multiplier !== 1 && <span className="badge gold">x{r.multiplier}</span>} {r.hasSprint && <span className="badge">Sprint</span>}</td>
                    <td>{ch?.name}</td>
                    <td>{categoryName(ch, s.categoryId)} {s.year}</td>
                    <td>{winner ? byId(db.drivers, winner.driverId)?.name : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Palmares({ db, p }: { db: DB; p: Promoter }) {
  const all = titles(db, p.id);
  const chs = db.championships.filter((c) => c.promoterId === p.id);
  const [form, setForm] = useState({ ch: chs[0]?.id ?? '', cat: chs[0]?.categories[0]?.id ?? '', year: new Date().getFullYear() - 1, driver: '', team: '' });
  const ch = byId(db.championships, form.ch);
  const counts = new Map<string, number>();
  all.forEach((t) => counts.set(t.driverName, (counts.get(t.driverName) ?? 0) + 1));
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const add = () => {
    if (!form.driver.trim() || !form.ch || !form.cat) return;
    update((d) => { d.manualTitles.push({ id: uid(), promoterId: p.id, championshipId: form.ch, categoryId: form.cat, year: +form.year, driverName: form.driver.trim(), teamName: form.team.trim() || undefined }); });
    setForm({ ...form, driver: '', team: '' });
  };
  return (
    <>
      <div className="two wide-left">
        <div>
          {chs.map((c) => c.categories.map((cat) => {
            const list = all.filter((t) => t.championshipId === c.id && t.categoryId === cat.id);
            if (!list.length) return null;
            return (
              <Card key={cat.id} title={<>🏆 {c.name} · {cat.name}</>}>
                <table>
                  <thead><tr><th>Año</th><th>Campeón de pilotos</th><th>Campeón de equipos</th><th>Puntos</th></tr></thead>
                  <tbody>
                    {list.map((t, i) => (
                      <tr key={i} onClick={() => t.seasonId && go(`s/${t.seasonId}`)}>
                        <td><b>{t.year}</b></td>
                        <td>{t.driverName} {t.manual && <span className="badge" title="Añadido a mano">histórico</span>}</td>
                        <td>{t.teamName ?? '—'}</td>
                        <td>{t.points ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          }))}
          {all.length === 0 && <Empty>El palmarés se rellena solo al marcar una temporada como «Finalizada». También puedes añadir campeones históricos.</Empty>}
        </div>
        <div>
          <Card title="Más títulos">
            {ranking.length ? <ol className="ranking">{ranking.map(([n, c]) => <li key={n}><span>{n}</span><b>{c}</b></li>)}</ol> : <Empty>—</Empty>}
          </Card>
          {chs.length > 0 && (
            <Card title="Añadir campeón histórico">
              <div className="form-col">
                <select value={form.ch} onChange={(e) => { const c = byId(db.championships, e.target.value); setForm({ ...form, ch: e.target.value, cat: c?.categories[0]?.id ?? '' }); }}>
                  {chs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                  {ch?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} />
                <input placeholder="Piloto campeón" value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} />
                <input placeholder="Equipo campeón (opcional)" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
                <button onClick={add}>Añadir al palmarés</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stats({ db, p }: { db: DB; p: Promoter }) {
  const rows = careerStats(db, p.id);
  return (
    <Card title="Estadísticas históricas de pilotos (todas las temporadas de la promotora)">
      {rows.length === 0 ? <Empty>Aún no hay resultados.</Empty> : (
        <table>
          <thead><tr><th>Piloto</th><th>Títulos</th><th>Temporadas</th><th>Salidas</th><th>Victorias</th><th>Podios</th><th>Poles</th><th>V. rápidas</th><th>Puntos</th><th>% victorias</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.driverId}>
                <td>{byId(db.drivers, r.driverId)?.name}</td>
                <td>{r.titles ? <b>🏆 {r.titles}</b> : 0}</td>
                <td>{r.seasons}</td><td>{r.starts}</td><td>{r.wins}</td><td>{r.podiums}</td><td>{r.poles}</td><td>{r.fastestLaps}</td>
                <td>{r.points}</td><td>{r.starts ? Math.round((r.wins / r.starts) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Drivers({ db, p }: { db: DB; p: Promoter }) {
  const [f, setF] = useState({ name: '', nat: '', num: '' });
  const list = db.drivers.filter((d) => d.promoterId === p.id);
  const add = () => {
    if (!f.name.trim()) return;
    update((d) => { d.drivers.push({ id: uid(), promoterId: p.id, name: f.name.trim(), nationality: f.nat.trim() || undefined, defaultNumber: f.num ? +f.num : undefined }); });
    setF({ name: '', nat: '', num: '' });
  };
  return (
    <Card title={`Pilotos (${list.length})`}>
      <div className="form-row">
        <input placeholder="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input placeholder="Nacionalidad" value={f.nat} onChange={(e) => setF({ ...f, nat: e.target.value })} style={{ maxWidth: 140 }} />
        <input placeholder="Dorsal" type="number" value={f.num} onChange={(e) => setF({ ...f, num: e.target.value })} style={{ maxWidth: 100 }} />
        <button onClick={add}>Añadir</button>
      </div>
      <table>
        <thead><tr><th>#</th><th>Nombre</th><th>Nac.</th><th></th></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id}>
              <td>{d.defaultNumber}</td>
              <td><input className="inline" value={d.name} onChange={(e) => update((x) => { byId(x.drivers, d.id)!.name = e.target.value; })} /></td>
              <td>{d.nationality}</td>
              <td className="right"><button className="ghost danger" onClick={() => confirmDelete(d.name) && update((x) => {
                x.drivers = x.drivers.filter((y) => y.id !== d.id);
                x.seasons.forEach((s) => { s.entries = s.entries.filter((e) => e.driverId !== d.id); });
              })}>Borrar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Teams({ db, p }: { db: DB; p: Promoter }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const list = db.teams.filter((t) => t.promoterId === p.id);
  const add = () => {
    if (!name.trim()) return;
    update((d) => { d.teams.push({ id: uid(), promoterId: p.id, name: name.trim(), color }); });
    setName('');
  };
  return (
    <Card title={`Equipos / constructores (${list.length})`}>
      <div className="form-row">
        <input placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={add}>Añadir</button>
      </div>
      <table>
        <tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td style={{ width: 40 }}><input type="color" value={t.color} onChange={(e) => update((x) => { byId(x.teams, t.id)!.color = e.target.value; })} /></td>
              <td><TeamDot color={t.color} /> {t.name}</td>
              <td className="right"><button className="ghost danger" onClick={() => confirmDelete(t.name) && update((x) => {
                x.teams = x.teams.filter((y) => y.id !== t.id);
                x.seasons.forEach((s) => s.entries.forEach((e) => { if (e.teamId === t.id) e.teamId = undefined; }));
              })}>Borrar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Settings({ p }: { p: Promoter }) {
  const set = (patch: Partial<Promoter>) => update((d) => { Object.assign(byId(d.promoters, p.id)!, patch); });
  return (
    <Card title="Ajustes de la promotora">
      <div className="form-col">
        <label>Nombre<input value={p.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Descripción<textarea value={p.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></label>
        <label>Color<input type="color" value={p.color} onChange={(e) => set({ color: e.target.value })} /></label>
        <button className="danger" onClick={() => {
          if (!confirmDelete(`la promotora «${p.name}» y todos sus datos`)) return;
          update((d) => {
            const chIds = new Set(d.championships.filter((c) => c.promoterId === p.id).map((c) => c.id));
            d.seasons = d.seasons.filter((s) => !chIds.has(s.championshipId));
            d.championships = d.championships.filter((c) => c.promoterId !== p.id);
            d.drivers = d.drivers.filter((x) => x.promoterId !== p.id);
            d.teams = d.teams.filter((x) => x.promoterId !== p.id);
            d.manualTitles = d.manualTitles.filter((x) => x.promoterId !== p.id);
            d.promoters = d.promoters.filter((x) => x.id !== p.id);
          });
          go('');
        }}>Borrar promotora</button>
      </div>
    </Card>
  );
}
