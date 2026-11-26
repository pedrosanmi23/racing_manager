import { useState } from 'react';
import { Card, Empty } from '../components/ui';
import { buildDemo } from '../lib/demo';
import { go } from '../lib/router';
import { seasonsOfPromoter } from '../lib/selectors';
import { exportJSON, getDB, importJSON, setDB, uid, update, useDB } from '../lib/store';

export default function Home() {
  const db = useDB();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#e10600');

  const create = () => {
    if (!name.trim()) return;
    const id = uid();
    update((d) => { d.promoters.push({ id, name: name.trim(), color, createdAt: new Date().toISOString() }); });
    go(`p/${id}`);
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>Tus promotoras</h1>
        <p>Crea una promotora, añade campeonatos y categorías, configura el reglamento de puntos y lleva las clasificaciones y el palmarés.</p>
      </div>
      <div className="grid">
        {db.promoters.map((p) => {
          const chs = db.championships.filter((c) => c.promoterId === p.id);
          const seasons = seasonsOfPromoter(db, p.id);
          return (
            <a key={p.id} className="tile" href={`#/p/${p.id}`} style={{ borderTopColor: p.color }}>
              <h2>{p.name}</h2>
              <p className="muted">{p.description}</p>
              <div className="stats"><span><b>{chs.length}</b> campeonatos</span><span><b>{seasons.length}</b> temporadas</span><span><b>{db.drivers.filter((d) => d.promoterId === p.id).length}</b> pilotos</span></div>
            </a>
          );
        })}
        {db.promoters.length === 0 && <Empty>Todavía no hay promotoras. Crea una o carga la demo para ver cómo funciona.</Empty>}
      </div>
      <div className="two">
        <Card title="Nueva promotora">
          <div className="form-row">
            <input placeholder="Nombre (p. ej. Dorna Sports)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" />
            <button onClick={create}>Crear</button>
          </div>
        </Card>
        <Card title="Datos">
          <div className="form-row">
            <button className="secondary" onClick={() => setDB(buildDemo(getDB()))}>Cargar demo</button>
            <button className="secondary" onClick={exportJSON}>Exportar copia</button>
            <label className="button secondary">Importar copia
              <input type="file" accept="application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { try { await importJSON(f); } catch (err) { alert(String(err)); } }
              }} />
            </label>
          </div>
          <p className="muted small">Los datos se guardan en este navegador. Exporta una copia para no perderlos.</p>
        </Card>
      </div>
    </div>
  );
}
