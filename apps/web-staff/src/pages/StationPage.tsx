import { useState, useEffect, useCallback } from 'react';
import { get, patch, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface OrderItem {
  productId: string; productName: string; productType: string;
  quantity: number; unitPrice: number;
}

interface Order {
  id: string; type: string; destination: string; status: number;
  table_ref: string | null; notes: string | null; created_at: string;
  waiter_first: string; waiter_last: string;
  guest_first: string; guest_last: string;
  items: OrderItem[];
}

const STATUS_LABEL: Record<number, string> = {
  1: 'Nuevo', 2: 'Preparando', 3: 'Despachado', 4: 'Recibido', 5: 'Entregado',
};
const STATUS_COLOR: Record<number, string> = {
  1: '#4a9eff', 2: '#ff9f4a', 3: '#4caf50', 4: '#9c6eff', 5: '#555',
};
const TYPE_LABEL: Record<string, string> = { bottle: 'Botella', drink: 'Bebida', shot: 'Shot' };

interface Props {
  destination: 'warehouse' | 'bar';
  title: string;
  eventId: string;
}

export default function StationPage({ destination, title, eventId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await get<Order[]>(
        `/orders?eventId=${eventId}&destination=${destination}&statuses=1,2,3`,
      );
      setOrders(data);
    } catch {
      // silent refresh failure
    }
  }, [eventId, destination]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function advance(orderId: string, nextStatus: number) {
    setAdvancing(orderId);
    setError(null);
    try {
      await patch(`/orders/${orderId}/status`, { status: nextStatus });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al actualizar');
    } finally {
      setAdvancing(null);
    }
  }

  const pending = orders.filter((o) => o.status === 1);
  const inProgress = orders.filter((o) => o.status === 2);
  const dispatched = orders.filter((o) => o.status === 3);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{title}</h1>
        <button style={s.refreshBtn} onClick={() => void load()}>↻ Actualizar</button>
      </div>
      {error && <p style={s.error}>{error}</p>}

      <div style={s.columns}>
        <Column
          heading="Nuevas"
          color="#4a9eff"
          orders={pending}
          advancing={advancing}
          actionLabel="Aceptar"
          actionStatus={2}
          onAdvance={advance}
        />
        <Column
          heading="En preparación"
          color="#ff9f4a"
          orders={inProgress}
          advancing={advancing}
          actionLabel="Despachar"
          actionStatus={3}
          onAdvance={advance}
        />
        <Column
          heading="Despachadas"
          color="#4caf50"
          orders={dispatched}
          advancing={null}
          actionLabel=""
          actionStatus={0}
          onAdvance={() => void 0}
        />
      </div>
    </div>
  );
}

function Column({
  heading, color, orders, advancing, actionLabel, actionStatus, onAdvance,
}: {
  heading: string; color: string; orders: Order[]; advancing: string | null;
  actionLabel: string; actionStatus: number; onAdvance: (id: string, s: number) => void;
}) {
  return (
    <div style={s.col}>
      <div style={{ ...s.colHeader, borderColor: color }}>
        <span style={{ ...s.colTitle, color }}>{heading}</span>
        <span style={s.colCount}>{orders.length}</span>
      </div>
      {orders.length === 0
        ? <p style={s.empty}>Sin comandas</p>
        : orders.map((o) => (
          <OrderCard
            key={o.id} order={o} advancing={advancing === o.id}
            actionLabel={actionLabel} actionStatus={actionStatus} onAdvance={onAdvance}
          />
        ))
      }
    </div>
  );
}

function OrderCard({ order: o, advancing, actionLabel, actionStatus, onAdvance }: {
  order: Order; advancing: boolean; actionLabel: string; actionStatus: number;
  onAdvance: (id: string, s: number) => void;
}) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div>
          <div style={s.guestName}>{o.guest_first} {o.guest_last}</div>
          {o.table_ref && <div style={s.tablRef}>Mesa: {o.table_ref}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...s.typeBadge, backgroundColor: o.type === 'pass' ? '#1a2a1a' : '#2a2a10', color: o.type === 'pass' ? '#4caf50' : '#d4af37' }}>
            {o.type === 'pass' ? 'PASS' : 'EXTRA'}
          </div>
          <div style={s.timeAgo}>{formatAge(o.created_at)}</div>
        </div>
      </div>
      <div style={s.itemList}>
        {o.items.map((item, i) => (
          <div key={i} style={s.itemRow}>
            <span style={s.itemName}>{item.productName}</span>
            <span style={s.itemQty}>×{item.quantity}</span>
          </div>
        ))}
      </div>
      {o.notes && <div style={s.notes}>{o.notes}</div>}
      <div style={s.cardFooter}>
        <span style={s.waiterLabel}>Mesero: {o.waiter_first} {o.waiter_last}</span>
        {actionStatus > 0 && (
          <button
            style={{ ...s.actionBtn, opacity: advancing ? 0.6 : 1 }}
            onClick={() => onAdvance(o.id, actionStatus)}
            disabled={advancing}
          >
            {advancing ? '...' : actionLabel}
          </button>
        )}
        {actionStatus === 0 && <span style={{ ...s.statusChip, backgroundColor: STATUS_COLOR[o.status] ?? '#555' }}>{STATUS_LABEL[o.status]}</span>}
      </div>
    </div>
  );
}

function formatAge(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

// We export this for the role selector too
export function EventSelector({ onSelect }: { onSelect: (id: string) => void }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string }[]>([]);

  useEffect(() => {
    get<{ id: string; name: string; event_date: string }[]>('/events')
      .then(setEvents)
      .catch(() => void 0);
  }, []);

  if (!user) return null;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Seleccionar evento</h1>
        {events.length === 0
          ? <p style={{ color: '#666' }}>Sin eventos activos</p>
          : events.map((ev) => (
            <button key={ev.id} style={s.evBtn} onClick={() => onSelect(ev.id)}>
              <span style={{ fontWeight: 600 }}>{ev.name}</span>
              <span style={{ color: '#888', fontSize: '0.82rem' }}>
                {new Date(ev.event_date).toLocaleDateString('es-GT')}
              </span>
            </button>
          ))
        }
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '1.25rem', color: '#f0f0f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  title: { margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#9c6eff' },
  refreshBtn: { background: 'none', border: '1px solid #3a3a3a', color: '#888', borderRadius: '5px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' },
  error: { color: '#e55', fontSize: '0.85rem', marginBottom: '0.75rem' },
  columns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' },
  col: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  colHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid', paddingLeft: '0.6rem', marginBottom: '0.25rem' },
  colTitle: { fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  colCount: { backgroundColor: '#2a2a2a', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 },
  empty: { color: '#444', fontSize: '0.82rem', padding: '0.5rem 0' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.85rem', maxWidth: '400px', width: '100%' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' },
  guestName: { fontWeight: 600, fontSize: '0.9rem' },
  tablRef: { fontSize: '0.78rem', color: '#888' },
  typeBadge: { fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', padding: '0.15rem 0.4rem', textAlign: 'center' as const },
  timeAgo: { fontSize: '0.72rem', color: '#666', marginTop: '0.25rem', textAlign: 'right' as const },
  itemList: { display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.5rem' },
  itemRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' },
  itemName: { color: '#ccc' },
  itemQty: { color: '#d4af37', fontWeight: 700 },
  notes: { fontSize: '0.78rem', color: '#888', fontStyle: 'italic', marginBottom: '0.5rem' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '0.5rem' },
  waiterLabel: { fontSize: '0.72rem', color: '#666' },
  actionBtn: { backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  statusChip: { fontSize: '0.72rem', fontWeight: 600, borderRadius: '3px', padding: '0.15rem 0.4rem', color: '#fff', textTransform: 'uppercase' as const },
  evBtn: { display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '7px', padding: '0.75rem 1rem', cursor: 'pointer', color: '#f0f0f0', textAlign: 'left', marginBottom: '0.5rem', gap: '0.2rem' },
};
