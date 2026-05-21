import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, post, patch, ApiError } from '../api/client';

interface Event {
  id: string; name: string; description: string | null;
  event_date: string; doors_open_at: string | null;
  status: string; total_pax: number; reserved_spots: number;
  ratio_target_women: string;
}
interface PassTier {
  id: string; name: string; description: string | null;
  price: string; currency: string; max_quantity: number | null; quantity_sold: number;
}
interface GuestEvent {
  id: string; status: string; invited_at: string; qr_token: string | null;
  first_name: string; last_name: string; phone: string; gender: string;
  tier_name: string | null; price: string | null; currency: string | null;
}

type Tab = 'guests' | 'pass-tiers';

const STATUS_LABEL: Record<string, string> = {
  en_lista: 'En lista', confirmed: 'Confirmado', rejected: 'Rechazado',
  paid: 'Pagado', checked_in: 'Checkin', checked_out: 'Salió',
};
const STATUS_COLOR: Record<string, string> = {
  en_lista: '#4a9eff', confirmed: '#4caf50', rejected: '#e55',
  paid: '#d4af37', checked_in: '#9c6eff', checked_out: '#666',
};

const EMPTY_TIER = { name: '', price: '', currency: 'GTQ', maxQuantity: '' };

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<PassTier[]>([]);
  const [guests, setGuests] = useState<GuestEvent[]>([]);
  const [tab, setTab] = useState<Tab>('guests');
  const [tierForm, setTierForm] = useState(EMPTY_TIER);
  const [showTierForm, setShowTierForm] = useState(false);
  const [savingTier, setSavingTier] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [ev, ts, gs] = await Promise.all([
      get<Event>(`/events/${id}`),
      get<PassTier[]>(`/events/${id}/pass-tiers`),
      get<GuestEvent[]>(`/guests?eventId=${id}`),
    ]);
    setEvent(ev);
    setTiers(ts);
    setGuests(gs);
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function updateStatus(guestEventId: string, status: string) {
    setStatusLoading(guestEventId);
    try {
      await patch(`/guests/${guestEventId}/status`, { status });
      await fetchAll();
    } finally {
      setStatusLoading(null);
    }
  }

  async function createTier(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingTier(true);
    setTierError(null);
    try {
      await post(`/events/${id}/pass-tiers`, {
        name: tierForm.name,
        price: parseFloat(tierForm.price),
        currency: tierForm.currency,
        ...(tierForm.maxQuantity ? { maxQuantity: parseInt(tierForm.maxQuantity, 10) } : {}),
      });
      setTierForm(EMPTY_TIER);
      setShowTierForm(false);
      await fetchAll();
    } catch (err) {
      setTierError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setSavingTier(false);
    }
  }

  if (!event) return <p style={{ color: '#666' }}>Cargando...</p>;

  return (
    <div>
      <Link to="/" style={s.backLink}>← Eventos</Link>

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>{event.name}</h1>
          <p style={s.subtitle}>
            {new Date(event.event_date).toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {event.description && <p style={s.desc}>{event.description}</p>}
        </div>
        <div style={s.statBox}>
          <div style={s.stat}><span style={s.statVal}>{guests.length}</span><span style={s.statLbl}>Invitados</span></div>
          <div style={s.stat}><span style={s.statVal}>{event.total_pax}</span><span style={s.statLbl}>Capacidad</span></div>
          <div style={s.stat}>
            <span style={s.statVal}>{guests.filter((g) => g.status === 'paid' || g.status === 'checked_in').length}</span>
            <span style={s.statLbl}>Pagados</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['guests', 'pass-tiers'] as Tab[]).map((t) => (
          <button key={t} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'guests' ? `Invitados (${guests.length})` : `Pass Tiers (${tiers.length})`}
          </button>
        ))}
      </div>

      {/* Pass Tiers tab */}
      {tab === 'pass-tiers' && (
        <div>
          <div style={s.sectionHeader}>
            <button style={s.primaryBtn} onClick={() => setShowTierForm((v) => !v)}>
              {showTierForm ? 'Cancelar' : '+ Agregar tier'}
            </button>
          </div>
          {showTierForm && (
            <form onSubmit={createTier} style={s.formInline}>
              <input style={s.input} placeholder="Nombre" value={tierForm.name} onChange={(e) => setTierForm((p) => ({ ...p, name: e.target.value }))} required />
              <input style={{ ...s.input, width: '100px' }} placeholder="Precio" type="number" min="0" step="0.01" value={tierForm.price} onChange={(e) => setTierForm((p) => ({ ...p, price: e.target.value }))} required />
              <input style={{ ...s.input, width: '80px' }} placeholder="GTQ" value={tierForm.currency} onChange={(e) => setTierForm((p) => ({ ...p, currency: e.target.value }))} required />
              <input style={{ ...s.input, width: '100px' }} placeholder="Max usos" type="number" min="1" value={tierForm.maxQuantity} onChange={(e) => setTierForm((p) => ({ ...p, maxQuantity: e.target.value }))} />
              {tierError && <span style={{ color: '#e55', fontSize: '0.85rem' }}>{tierError}</span>}
              <button style={s.primaryBtn} type="submit" disabled={savingTier}>{savingTier ? '...' : 'Guardar'}</button>
            </form>
          )}
          {tiers.length === 0 ? <p style={{ color: '#666', marginTop: '1rem' }}>Sin tiers aún.</p> : (
            <div style={s.tierList}>
              {tiers.map((t) => (
                <div key={t.id} style={s.tierCard}>
                  <span style={s.tierName}>{t.name}</span>
                  <span style={s.tierPrice}>{t.currency} {parseFloat(t.price).toFixed(2)}</span>
                  {t.max_quantity && <span style={s.tierMeta}>{t.quantity_sold}/{t.max_quantity} vendidos</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guests tab */}
      {tab === 'guests' && (
        <div style={s.tableWrap}>
          {guests.length === 0 ? <p style={{ color: '#666' }}>Sin invitados aún.</p> : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Nombre', 'Teléfono', 'Género', 'Tier', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} style={s.tr}>
                    <td style={s.td}>{g.first_name} {g.last_name}</td>
                    <td style={s.td}>{g.phone}</td>
                    <td style={s.td}>{g.gender}</td>
                    <td style={s.td}>{g.tier_name ?? '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, backgroundColor: STATUS_COLOR[g.status] ?? '#555' }}>
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <GuestActions
                        ge={g}
                        loading={statusLoading === g.id}
                        onUpdate={(status) => void updateStatus(g.id, status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function GuestActions({ ge, loading, onUpdate }: {
  ge: GuestEvent;
  loading: boolean;
  onUpdate: (s: string) => void;
}) {
  if (loading) return <span style={{ color: '#888', fontSize: '0.8rem' }}>...</span>;
  const btn = (label: string, status: string, color = '#3a3a3a') => (
    <button key={status} style={{ ...actionS.btn, backgroundColor: color }} onClick={() => onUpdate(status)}>{label}</button>
  );
  switch (ge.status) {
    case 'en_lista': return <>{btn('Confirmar', 'confirmed', '#1a3a1a')}{btn('Rechazar', 'rejected', '#3a1a1a')}</>;
    case 'confirmed': return <>{btn('Rechazar', 'rejected', '#3a1a1a')}{btn('Pagado + QR', 'paid', '#3a3010')}</>;
    case 'rejected': return <>{btn('Restablecer', 'en_lista')}</>;
    case 'paid': return <span style={{ color: '#d4af37', fontSize: '0.8rem' }}>{ge.qr_token ? '✓ QR emitido' : 'QR pendiente'}</span>;
    case 'checked_in': return <span style={{ color: '#9c6eff', fontSize: '0.8rem' }}>✓ Adentro</span>;
    default: return null;
  }
}

const actionS: Record<string, React.CSSProperties> = {
  btn: { border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', color: '#f0f0f0', fontSize: '0.78rem', cursor: 'pointer', marginRight: '0.3rem' },
};

const s: Record<string, React.CSSProperties> = {
  backLink: { color: '#888', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block', marginBottom: '1.25rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' },
  h1: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 },
  subtitle: { color: '#888', margin: '0 0 0.5rem', fontSize: '0.9rem' },
  desc: { color: '#bbb', margin: 0, fontSize: '0.9rem' },
  statBox: { display: 'flex', gap: '1.5rem' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statVal: { fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 },
  statLbl: { fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' },
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #222', paddingBottom: '0.75rem' },
  tabBtn: { background: 'none', border: 'none', color: '#888', fontSize: '0.9rem', cursor: 'pointer', padding: '0.4rem 0.75rem', borderRadius: '6px' },
  tabActive: { backgroundColor: '#2a2a2a', color: '#f0f0f0' },
  sectionHeader: { display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' },
  primaryBtn: { backgroundColor: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
  formInline: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.5rem 0.65rem', color: '#f0f0f0', fontSize: '0.88rem', outline: 'none', flex: 1, minWidth: '120px' },
  tierList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  tierCard: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem' },
  tierName: { fontWeight: 600, flex: 1 },
  tierPrice: { color: '#d4af37', fontWeight: 700 },
  tierMeta: { color: '#888', fontSize: '0.85rem' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.75rem', color: '#888', fontWeight: 500, borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #1a1a1a' },
  td: { padding: '0.7rem 0.75rem', verticalAlign: 'middle' },
  badge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', padding: '0.2rem 0.5rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' },
};
