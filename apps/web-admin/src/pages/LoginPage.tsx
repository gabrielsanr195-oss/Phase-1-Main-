import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', venueSlug: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await post<LoginResponse>('/auth/login', form);
      login(res.accessToken, res.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Phase 1+ Admin</h1>
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Email</label>
          <input style={s.input} name="email" type="email" value={form.email} onChange={handleChange} required autoFocus />

          <label style={s.label}>Contraseña</label>
          <input style={s.input} name="password" type="password" value={form.password} onChange={handleChange} required />

          <label style={s.label}>Venue slug</label>
          <input style={s.input} name="venueSlug" value={form.venueSlug} onChange={handleChange} required placeholder="club-xyz" />

          {error && <p style={s.error}>{error}</p>}

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '380px', color: '#f0f0f0' },
  title: { fontSize: '1.4rem', fontWeight: 700, margin: '0 0 1.5rem', color: '#d4af37' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.6rem 0.75rem', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none' },
  error: { color: '#e55', fontSize: '0.85rem', margin: '0.25rem 0' },
  btn: { marginTop: '1rem', backgroundColor: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' },
};
