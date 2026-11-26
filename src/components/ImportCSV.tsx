import { useState } from 'react';
import { DRIVERS_TEMPLATE, importDrivers, importTeams, parseCSV, TEAMS_TEMPLATE, type ImportSummary } from '../lib/csv';
import { getDB, uid, update } from '../lib/store';

type Kind = 'drivers' | 'teams';

/** Botón para importar pilotos o equipos desde CSV, con vista previa antes de guardar. */
export default function ImportCSV({ kind, promoterId, seasonId }: { kind: Kind; promoterId: string; seasonId?: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState('');
  const run = kind === 'drivers'
    ? (db: Parameters<typeof importDrivers>[0], r: string[][]) => importDrivers(db, promoterId, r, uid, seasonId)
    : (db: Parameters<typeof importTeams>[0], r: string[][]) => importTeams(db, promoterId, r, uid);

  const onFile = async (file: File) => {
    const parsed = parseCSV(await file.text());
    setRows(parsed);
    setPreview(run(structuredClone(getDB()), parsed)); // simulación sobre una copia
    setDone('');
  };
  const confirm = () => {
    if (!rows) return;
    let s: ImportSummary | undefined;
    update((d) => { s = run(d, rows); });
    setDone(describe(kind, s!, !!seasonId) + ' ✓');
    setRows(null); setPreview(null);
  };
  const template = () => {
    const blob = new Blob(['﻿' + (kind === 'drivers' ? DRIVERS_TEMPLATE : TEAMS_TEMPLATE)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = kind === 'drivers' ? 'plantilla-pilotos.csv' : 'plantilla-equipos.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="import">
      <div className="form-row">
        <label className="button secondary">⬆ Importar {kind === 'drivers' ? 'pilotos' : 'equipos'} desde CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        <button className="ghost" onClick={template}>Descargar plantilla</button>
        {done && <span className="muted small">{done}</span>}
      </div>
      {preview && (
        <div className="banner">
          <b>Vista previa:</b> {describe(kind, preview, !!seasonId)}.
          {preview.warnings.length > 0 && (
            <ul className="warnings">{preview.warnings.slice(0, 8).map((w, i) => <li key={i}>⚠ {w}</li>)}
              {preview.warnings.length > 8 && <li>…y {preview.warnings.length - 8} avisos más</li>}</ul>
          )}
          <div className="form-row">
            <button onClick={confirm} disabled={preview.created + preview.updated === 0}>Importar</button>
            <button className="ghost" onClick={() => { setRows(null); setPreview(null); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function describe(kind: Kind, s: ImportSummary, inSeason: boolean) {
  if (kind === 'teams') return `${s.created} equipos nuevos, ${s.updated} actualizados`;
  const parts = [`${s.created} pilotos nuevos`, `${s.updated} actualizados`];
  if (s.teamsCreated) parts.push(`${s.teamsCreated} equipos nuevos`);
  if (inSeason) parts.push(`${s.enrolled} inscritos en la temporada`);
  return parts.join(', ');
}
