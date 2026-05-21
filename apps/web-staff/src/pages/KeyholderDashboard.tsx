import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface KhEvent {
  id: string; name: string; event_date: string; status: string;
  total_pax: number; threshold: number; invites_used: number;
}
interface PassTier { id: string; name: string; price: string; currency: string; }
interface ShareLink {
  id: string; token: string; link_type: string; uses_count: number;
  max_uses: number | null; expires_at: string | null; is_active: boolean;
  tier_name: string;
}
interface GuestRow {
  id: string; first_name: string; last_name: string; phone: string;
  gender: string; status: string; invited_at: string; tier_name: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  en_lista: '#4a9eff', confirmed: '#4caf50', rejected: '#e55',
  paid: '#d4af37', checked_in: '#9c6eff', checked_out: '#666',
};
const STATUS_LABEL: Record<string, string> = {
  en_lista: 'Lista', confirmed: 'Confirmado', rejected: 'Rechazado',
  paid: 'Pagado', checked_in: 'Adentro', checked_out: 'Salió',
};

type View = { kind: 'events' } | { kind: 'event'; event: KhEvent };

export default function KeyholderDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: 'events' });
  const [events, setEvents] = useState<KhEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<KhEvent[]>('/events')
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.brand}>Keyholders</span>
        <span style={s.name}>{user?.firstName}</span>
        <button style={s.logoutBtn} onClick={handleLogout}>Salir</button>
      </div>
      <div style={s.content}>
        {view.kind === 'events' && (
          <EventsList events={events} loading={loading} onSelect={(ev) => setView({ kind: 'event', event: ev })} />
        )}
        {view.kind === 'event' && (
          <EventView event={view.event} onBack={() => setView({ kind: 'events' })} />
        )}
      </div>
    </div>
  );
}

function EventsList({ events, loading, onSelect }: {
  events: KhEvent[]; loading: boolean; onSelect: (e: KhEvent) => void;
}) {
  if (loading) return <p style={s.muted}>Cargando...</p>;
  if (!events.length) return <p style={s.muted}>No tienes eventos asignados.</p>;
  return (
    <div>
      <h2 style={s.sectionTitle}>Mis eventos</h2>
      <div style={s.list}>
        {events.map((ev) => (
          <button key={ev.id} style={s.eventCard} onClick={() => onSelect(ev)}>
            <div style={s.evName}>{ev.name}</div>
            <div style={s.evMeta}>
              {new Date(ev.event_date).toLocaleDateString('es-GT', { weekday: 'short', month: 'short', day: 'numeric' })}
              &nbsp;·&nbsp;
              {ev.invites_used}/{ev.threshold} invitaciones
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventView({ event, onBack }: { event: KhEvent; onBack: () => void }) {
  const [tiers, setTiers] = useState<PassTier[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [tab, setTab] = useState<'guests' | 'links'>('guests');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ passTierId: '', linkType: 'open' as 'open' | 'ratio_gated' | 'threshold_gated', maxUses: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [ts, ls, gs] = await Promise.all([
      get<PassTier[]>(`/events/${event.id}/pass-tiers`),
      get<ShareLink[]>('/share-links'),
      get<GuestRow[]>(`/guests?eventId=${event.id}`),
    ]);
    setTiers(ts);
    setLinks(ls.filter((l: ShareLink & { event_id?: string }) => l.event_id === event.id || true));
    setGuests(gs);
  }, [event.id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await post('/share-links', {
        eventId: event.id,
        passTierId: linkForm.passTierId,
        linkType: linkForm.linkType,
        ...(linkForm.maxUses ? { maxUses: parseInt(linkForm.maxUses, 10) } : {}),
      });
      setLinkForm({ passTierId: '', linkType: 'open', maxUses: '' });
      setShowLinkForm(false);
      await fetchAll();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Error al crear link');
    } finally {
      setSaving(false);
    }
  }

  const shareBase = (import.meta.env.VITE_GUEST_URL as string | undefined) ?? window.location.origin.replace('5174', '5173');

  return (
    <div>
      <button style={s.backBtn} onClick={onBack}>← Mis eventos</button>
      <h2 style={s.sectionTitle}>{event.name}</h2>
      <p style={s.evDateFull}>
        {new Date(event.event_date).toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <div style={s.inviteStats}>
        <span style={s.inviteCount}>{event.invites_used}</span>
        <span style={s.inviteLabel}> / {event.threshold} invitaciones usadas</span>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['guests', 'links'] as const).map((t) => (
          <button key={t} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'guests' ? `Invitados (${guests.length})` : `Links (${links.length})`}
          </button>
        ))}
      </div>

      {/* Share links tab */}
      {tab === 'links' && (
        <div>
          {tiers.length === 0 ? (
            <p style={s.muted}>Este evento no tiene pass tiers. El admin debe crearlos primero.</p>
          ) : (
            <div style={s.sectionHeader}>
              <button style={s.primaryBtn} onClick={() => setShowLinkForm((v) => !v)}>
                {showLinkForm ? 'Cancelar' : '+ Nuevo link'}
              </button>
            </div>
          )}

          {showLinkForm && tiers.length > 0 && (
            <form onSubmit={createLink} style={s.formRow}>
              <select style={s.input} value={linkForm.passTierId} onChange={(e) => setLinkForm((p) => ({ ...p, passTierId: e.target.value }))} required>
                <option value="">Seleccionar tier...</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.currency} {parseFloat(t.price).toFixed(2)}</option>)}
              </select>
              <select style={{ ...s.input, width: '160px' }} value={linkForm.linkType} onChange={(e) => setLinkForm((p) => ({ ...p, linkType: e.target.value as typeof p.linkType }))}>
                <option value="open">Abierto</option>
                <option value="ratio_gated">Ratio mujeres</option>
                <option value="threshold_gated">Con límite</option>
              </select>
              <input style={{ ...s.input, width: '100px' }} type="number" min="1" placeholder="Máx usos" value={linkForm.maxUses} onChange={(e) => setLinkForm((p) => ({ ...p, maxUses: e.target.value }))} />
              {saveError && <span style={{ color: '#e55', fontSize: '0.82rem' }}>{saveError}</span>}
              <button style={s.primaryBtn} type="submit" disabled={saving}>{saving ? '...' : 'Crear'}</button>
            </form>
          )}

          <div style={s.linkList}>
            {links.map((l) => (
              <div key={l.id} style={s.linkCard}>
                <div style={s.linkMeta}>
                  <span style={s.linkType}>{l.link_type}</span>
                  <span style={{ color: '#888', fontSize: '0.82rem' }}>{l.uses_count}{l.max_uses ? `/${l.max_uses}` : ''} usos</span>
                </div>
                <div style={s.linkUrl}>
                  <code style={s.linkCode}>{shareBase}/r/{l.token}</code>
                  <button style={s.copyBtn} onClick={() => void navigator.clipboard.writeText(`${shareBase}/r/${l.token}`)}>
                    Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guests tab */}
      {tab === 'guests' && (
        <div style={s.guestList}>
          {guests.length === 0 ? <p style={s.muted}>Sin invitados aún.</p> : guests.map((g) => (
            <div key={g.id} style={s.guestCard}>
              <div style={s.guestInfo}>
                <span style={s.guestName}>{g.first_name} {g.last_name}</span>
                <span style={s.guestPhone}>{g.phone}</span>
              </div>
              <span style={{ ...s.statusBadge, backgroundColor: STATUS_COLOR[g.status] ?? '#555' }}>
                {STATUS_LABEL[g.status] ?? g.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#f0f0f0', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid #1a1a1a', backgroundColor: '#111' },
  brand: { fontWeight: 700, color: '#d4af37', fontSize: '1rem', flex: 1 },
  name: { fontSize: '0.85rem', color: '#aaa' },
  logoutBtn: { background: 'none', border: '1px solid #333', color: '#888', borderRadius: '5px', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem' },
  content: { flex: 1, padding: '1.5rem' },
  sectionTitle: { margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 700 },
  list: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  eventCard: { background: '#1a1a1a', border: '1px solid #222', borderRadius: '9px', padding: '1rem', cursor: 'pointer', textAlign: 'left', color: '#f0f0f0', width: '100%' },
  evName: { fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' },
  evMeta: { color: '#888', fontSize: '0.82rem' },
  backBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' },
  evDateFull: { color: '#888', fontSize: '0.85rem', margin: '0 0 0.75rem' },
  inviteStats: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.75rem 1rem', display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.25rem' },
  inviteCount: { fontSize: '1.4rem', fontWeight: 700, color: '#d4af37' },
  inviteLabel: { color: '#888', fontSize: '0.85rem' },
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #222', paddingBottom: '0.75rem' },
  tabBtn: { background: 'none', border: 'none', color: '#888', fontSize: '0.9rem', cursor: 'pointer', padding: '0.35rem 0.7rem', borderRadius: '6px' },
  tabActive: { backgroundColor: '#2a2a2a', color: '#f0f0f0' },
  sectionHeader: { display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' },
  primaryBtn: { backgroundColor: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', padding: '0.5rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
  formRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.5rem 0.65rem', color: '#f0f0f0', fontSize: '0.88rem', outline: 'none', flex: 1, minWidth: '140px', boxSizing: 'border-box' },
  linkList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  linkCard: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.75rem 1rem' },
  linkMeta: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem' },
  linkType: { fontSize: '0.78rem', backgroundColor: '#2a2a2a', borderRadius: '4px', padding: '0.15rem 0.4rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' },
  linkUrl: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  linkCode: { fontSize: '0.78rem', color: '#d4af37', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: { background: 'none', border: '1px solid #333', borderRadius: '4px', color: '#aaa', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 },
  muted: { color: '#666', fontSize: '0.9rem' },
  guestList: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  guestCard: { backgroundColor: '#1a1a1a', borderRadius: '7px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  guestInfo: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  guestName: { fontWeight: 600, fontSize: '0.9rem' },
  guestPhone: { color: '#888', fontSize: '0.8rem' },
  statusBadge: { fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', padding: '0.2rem 0.45rem', color: '#fff', textTransform: 'uppercase' },
};
