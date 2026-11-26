import { useRoute } from './lib/router';
import Home from './pages/Home';
import PromoterPage from './pages/PromoterPage';
import ChampionshipPage from './pages/ChampionshipPage';
import SeasonPage from './pages/SeasonPage';
import RoundPage from './pages/RoundPage';

export default function App() {
  const r = useRoute();
  let page;
  if (r[0] === 'p' && r[1]) page = <PromoterPage id={r[1]} tab={r[2] ?? 'campeonatos'} />;
  else if (r[0] === 'c' && r[1]) page = <ChampionshipPage id={r[1]} />;
  else if (r[0] === 's' && r[1] && r[2] === 'r' && r[3]) page = <RoundPage seasonId={r[1]} roundId={r[3]} />;
  else if (r[0] === 's' && r[1]) page = <SeasonPage id={r[1]} tab={r[2] ?? 'clasificacion'} />;
  else page = <Home />;
  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand"><span className="flag" />Paddock</a>
        <span className="tagline">Gestión de campeonatos de motor</span>
      </header>
      <main>{page}</main>
    </>
  );
}
