import { useState, useEffect } from 'react';
import { get, post, ApiError } from '../api/client';

interface Keyholder {
  id: string; display_name: string | null; is_active: boolean; created_at: string;
  user_id: string; email: string; first_name: string; last_name: string; phone: string | null;
}
interface Event { id: string; name: string; event_date: string; }
interface AssignState { keyholderId: string; eventId: string; threshold: string; }

const EMPTY_KH = { email: '', password: '', firstName: '', lastName: '', phone: '', displayName: '' };

export default function KeyholdersPage() {
  const [keyholders, setKeyholders] = useState<Keyholder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_KH);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [assign, setAssign] = useState<AssignState | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  async function fetchData() {
    const [khs, evs] = await Promise.all([
      get<Keyholder[]>('/keyholders'),
      get<Event[]>('/events'),
    ]);
    setKeyholders(khs);
    setEvents(evs);
  }

  useEffect(() => { void fetchData(); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await post('/keyholders', {
        email: form.email, password: form.password,
        firstName: form.firstName, lastName: form.lastName,
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.displayName ? { displayName: form.displayName } : {}),
      });
      setForm(EMPTY_KH);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Error al crear keyholder');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assign) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      await post(`/keyholders/${assign.keyholderId}/events`, {
        eventId: assign.eventId,
        threshold: parseInt(assign.threshold, 10),
      });
      setAssign(null);
      await fetchData();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : 'Error al asignar');
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Keyholders</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo keyholder'}
        </button>
      </div>

      {showForm && (
        <div style={s.card}>
          <h2 style={s.h2}>Crear keyholder</h2>
          <form onSubmit={handleCreate} style={s.form}>
            <div style={s.row}>
              <div style={s.field}><label style={s.label}>Nombre *</label><input style={s.input} name="firstName" value={form.firstName} onChange={handleChange} required /></div>
              <div style={s.field}><label style={s.label}>Apellido *</label><input style={s.input} name="lastName" value={form.lastName} onChange={handleChange} required /></div>
            </div>
            <div style={s.row}>
              <div style={s.field}><label style={s.label}>Email *</label><input style={s.input} name="email" type="email" value={form.email} onChange={handleChange} required /></div>
              <div style={s.field}><label style={s.label}>Contraseña *</label><input style={s.input} name="password" type="password" value={form.password} onChange={handleChange} required minLength={8} /></div>
            </div>
            <div style={s.row}>
              <div style={s.field}><label style={s.label}>Teléfono</label><input style={s.input} name="phone" value={form.phone} onChange={handleChange} /></div>
              <div style={s.field}><label style={s.label}>Nombre display</label><input style={s.input} name="displayName" value={form.displayName} onChange={handleChange} /></div>
            </div>
            {formError && <p style={s.error}>{formError}</p>}
            <button style={s.primaryBtn} type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</button>
          </form>
        </div>
      )}

      {assign && (
        <div style={s.card}>
          <h2 style={s.h2}>Asignar a evento</h2>
          <form onSubmit={handleAssign} style={s.formInline}>
            <select style={s.input} value={assign.eventId} onChange={(e) => setAssign((p) => p ? { ...p, eventId: e.target.value } : null)} required>
              <option value="">Seleccionar evento...</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <input style={{ ...s.input, width: '120px' }} type="number" min="0" placeholder="Threshold" value={assign.threshold} onChange={(e) => setAssign((p) => p ? { ...p, threshold: e.target.value } : null)} required />
            {assignError && <span style={{ color: '#e55', fontSize: '0.85rem' }}>{assignError}</span>}
            <button style={s.primaryBtn} type="submit" disabled={assignSaving}>{assignSaving ? '...' : 'Asignar'}</button>
            <button style={s.ghostBtn} type="button" onClick={() => setAssign(null)}>Cancelar</button>
          </form>
        </div>
      )}

      {keyholders.length === 0 ? (
        <p style={s.muted}>Sin keyholders aún.</p>
      ) : (
        <div style={s.list}>
          {keyholders.map((kh) => (
            <div key={kh.id} style={s.khCard}>
              <div style={s.khInfo}>
                <span style={s.khName}>{kh.first_name} {kh.last_name}</span>
                {kh.display_name && <span style={s.khDisplay}> ({kh.display_name})</span>}
                <span style={s.khEmail}>{kh.email}</span>
              </div>
              <button style={s.ghostBtn} onClick={() => setAssign({ keyholderId: kh.id, eventId: '', threshold: '0' })}>
                Asignar a evento
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  h1: { margin: 0, fontSize: '1.5rem', fontWeight: 700 },
  h2: { margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 600 },
  primaryBtn: { backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' },
  ghostBtn: { background: 'none', border: '1px solid #3a3a3a', borderRadius: '6px', color: '#aaa', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  formInline: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' },
  row: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '150px' },
  label: { fontSize: '0.78rem', color: '#888' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.55rem 0.7rem', color: '#f0f0f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', width: '100%' },
  error: { color: '#e55', fontSize: '0.85rem' },
  muted: { color: '#666' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  khCard: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
  khInfo: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  khName: { fontWeight: 600, fontSize: '0.95rem' },
  khDisplay: { color: '#888', fontSize: '0.85rem' },
  khEmail: { color: '#888', fontSize: '0.82rem' },
};
