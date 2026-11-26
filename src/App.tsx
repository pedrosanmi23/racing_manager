import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRoute } from './lib/router';
import { supabase } from './lib/cloud';
import { MODE, reloadFromCloud, retrySync, useSync } from './lib/store';
import Home from './pages/Home';
import Login from './pages/Login';
import PromoterPage from './pages/PromoterPage';
import ChampionshipPage from './pages/ChampionshipPage';
import SeasonPage from './pages/SeasonPage';
import RoundPage from './pages/RoundPage';

export default function App() {
  const r = useRoute();
  const [session, setSession] = useState<Session | null | undefined>(MODE === 'local' ? null : undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  useEffect(() => { if (MODE === 'cloud' && userId) reloadFromCloud(); }, [userId]);

  let page;
  if (MODE === 'cloud' && session === undefined) page = <p className="muted">Cargando…</p>;
  else if (MODE === 'cloud' && !session) page = <Login />;
  else if (r[0] === 'p' && r[1]) page = <PromoterPage id={r[1]} tab={r[2] ?? 'campeonatos'} />;
  else if (r[0] === 'c' && r[1]) page = <ChampionshipPage id={r[1]} />;
  else if (r[0] === 's' && r[1] && r[2] === 'r' && r[3]) page = <RoundPage seasonId={r[1]} roundId={r[3]} />;
  else if (r[0] === 's' && r[1]) page = <SeasonPage id={r[1]} tab={r[2] ?? 'clasificacion'} />;
  else page = <Home />;
  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand"><span className="flag" />Paddock</a>
        <span className="tagline">Gestión de campeonatos de motor</span>
        <span className="spacer" />
        {MODE === 'cloud' && session && <>
          <SyncBadge />
          <span className="muted small">{session.user.email}</span>
          <button className="ghost" onClick={() => supabase!.auth.signOut()}>Salir</button>
        </>}
        {MODE === 'local' && <span className="badge" title="Los datos se guardan solo en este navegador">Modo local</span>}
      </header>
      <main>{page}</main>
    </>
  );
}

function SyncBadge() {
  const s = useSync();
  if (s.state === 'error') return <button className="ghost danger" title={s.error} onClick={retrySync}>⚠ Error al guardar · reintentar</button>;
  const label = { idle: 'Sincronizado', saved: 'Guardado', saving: 'Guardando…', loading: 'Cargando…' }[s.state];
  return <span className={`sync ${s.state}`}>{label}</span>;
}
