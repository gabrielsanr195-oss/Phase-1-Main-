import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { get, post, ApiError } from '../api/client';

interface Event {
  id: string;
  name: string;
  event_date: string;
  status: string;
  total_pax: number;
  reserved_spots: number;
}

const STATUS_COLOR: Record<string, string> = {
  phase_0: '#888', phase_1: '#4a9eff', phase_2: '#9c6eff',
  phase_3: '#ff9f4a', phase_4: '#ff4a6e', closed: '#555',
};

const EMPTY_FORM = {
  name: '', eventDate: '', totalPax: '', description: '',
  doorsOpenAt: '', ratioTargetWomen: '0.5',
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchEvents() {
    try {
      const data = await get<Event[]>('/events');
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchEvents(); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await post('/events', {
        name: form.name,
        eventDate: new Date(form.eventDate).toISOString(),
        totalPax: parseInt(form.totalPax, 10),
        ...(form.description ? { description: form.description } : {}),
        ...(form.doorsOpenAt ? { doorsOpenAt: new Date(form.doorsOpenAt).toISOString() } : {}),
        ratioTargetWomen: parseFloat(form.ratioTargetWomen),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchEvents();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Error al crear evento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Eventos</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo evento'}
        </button>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h2 style={s.h2}>Crear evento</h2>
          <form onSubmit={handleCreate} style={s.form}>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Fecha y hora *</label>
                <input style={s.input} name="eventDate" type="datetime-local" value={form.eventDate} onChange={handleChange} required />
              </div>
            </div>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Capacidad total *</label>
                <input style={s.input} name="totalPax" type="number" min="1" value={form.totalPax} onChange={handleChange} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Apertura de puertas</label>
                <input style={s.input} name="doorsOpenAt" type="datetime-local" value={form.doorsOpenAt} onChange={handleChange} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Ratio mujeres (0–1)</label>
                <input style={s.input} name="ratioTargetWomen" type="number" min="0" max="1" step="0.05" value={form.ratioTargetWomen} onChange={handleChange} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Descripción</label>
              <textarea style={{ ...s.input, height: '70px', resize: 'vertical' }} name="description" value={form.description} onChange={handleChange} />
            </div>
            {formError && <p style={s.error}>{formError}</p>}
            <button style={s.primaryBtn} type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear evento'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p style={s.muted}>Cargando...</p>
      ) : events.length === 0 ? (
        <p style={s.muted}>No hay eventos aún.</p>
      ) : (
        <div style={s.eventList}>
          {events.map((ev) => (
            <Link key={ev.id} to={`/events/${ev.id}`} style={s.eventCard}>
              <div style={s.eventTop}>
                <span style={s.eventName}>{ev.name}</span>
                <span style={{ ...s.statusBadge, backgroundColor: STATUS_COLOR[ev.status] ?? '#555' }}>
                  {ev.status}
                </span>
              </div>
              <div style={s.eventMeta}>
                <span>{new Date(ev.event_date).toLocaleDateString('es-GT', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                <span>{ev.total_pax} pax</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  h1: { margin: 0, fontSize: '1.5rem', fontWeight: 700 },
  h2: { margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600 },
  primaryBtn: { backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.55rem 1.1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' },
  formCard: { backgroundColor: '#1a1a1a', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  row: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '160px' },
  label: { fontSize: '0.78rem', color: '#888' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.55rem 0.7rem', color: '#f0f0f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', width: '100%' },
  error: { color: '#e55', fontSize: '0.85rem' },
  muted: { color: '#666' },
  eventList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  eventCard: { backgroundColor: '#1a1a1a', borderRadius: '9px', padding: '1rem 1.25rem', textDecoration: 'none', color: '#f0f0f0', display: 'block', border: '1px solid #222' },
  eventTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' },
  eventName: { fontWeight: 600, fontSize: '1rem' },
  statusBadge: { fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', padding: '0.2rem 0.5rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' },
  eventMeta: { display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#888' },
};
