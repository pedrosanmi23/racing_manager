import type { ReactNode } from 'react';
import { go } from '../lib/router';

export function Tabs({ tabs, active, base }: { tabs: [string, string][]; active: string; base: string }) {
  return (
    <nav className="tabs">
      {tabs.map(([id, label]) => (
        <a key={id} href={`#/${base}/${id}`} className={id === active ? 'active' : ''}>{label}</a>
      ))}
    </nav>
  );
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <div className="crumbs">
      <a href="#/">Promotoras</a>
      {items.map(([label, href], i) => (
        <span key={i}> / {href ? <a href={`#/${href}`}>{label}</a> : <b>{label}</b>}</span>
      ))}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && <header><h3>{title}</h3><div>{actions}</div></header>}
      {children}
    </section>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export const TeamDot = ({ color }: { color?: string }) => <span className="dot" style={{ background: color ?? '#666' }} />;

export function PosCell({ pos, status, dropped, extra }: { pos?: number; status?: string; dropped?: boolean; extra?: string }) {
  const label = pos ?? (status === 'dnf' ? 'Ret' : status === 'dsq' ? 'DSQ' : status === 'dns' ? 'NS' : '');
  const cls = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : pos && pos <= 10 ? 'pts' : status ? 'out' : 'none';
  return <td className={`pos ${cls} ${dropped ? 'dropped' : ''}`} title={dropped ? 'Resultado descartado' : undefined}>{label}{extra && <sup>{extra}</sup>}</td>;
}

export function Back({ to, children }: { to: string; children: ReactNode }) {
  return <button className="ghost" onClick={() => go(to)}>← {children}</button>;
}

export function confirmDelete(what: string) {
  return window.confirm(`¿Seguro que quieres borrar ${what}? No se puede deshacer.`);
}
