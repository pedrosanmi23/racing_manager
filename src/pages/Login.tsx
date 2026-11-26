import { useState } from 'react';
import { supabase } from '../lib/cloud';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const auth = supabase!.auth;
    const { data, error } = mode === 'in'
      ? await auth.signInWithPassword({ email, password })
      : await auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    setBusy(false);
    if (error) setMsg(traducir(error.message));
    else if (mode === 'up' && !data.session) setMsg('Te hemos enviado un correo para confirmar la cuenta. Ábrelo y vuelve a entrar.');
  };

  return (
    <div className="page login">
      <div className="card">
        <h1>{mode === 'in' ? 'Entrar' : 'Crear cuenta'}</h1>
        <p className="muted">Tus promotoras, temporadas y resultados se guardan en la nube y puedes compartirlos con otros organizadores.</p>
        <form className="form-col" onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Contraseña<input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button disabled={busy}>{busy ? '…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
          {msg && <p className="banner">{msg}</p>}
        </form>
        <button className="ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(''); }}>
          {mode === 'in' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Entra'}
        </button>
      </div>
    </div>
  );
}

function traducir(m: string) {
  if (/invalid login/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/not confirmed/i.test(m)) return 'Tienes que confirmar tu email antes de entrar (revisa tu correo).';
  if (/already registered/i.test(m)) return 'Ya existe una cuenta con ese email.';
  return m;
}
