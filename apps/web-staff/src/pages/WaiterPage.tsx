import { useState, useEffect, useRef } from 'react';
import { get, post, patch, ApiError } from '../api/client';

interface Product {
  id: string; name: string; type: 'bottle' | 'drink' | 'shot'; sku: string | null;
}

interface PassBalanceItem {
  productId: string; productName: string;
  allocated: number; consumed: number; remaining: number;
}

interface GuestInfo {
  guestEventId: string; eventId: string; status: string;
  firstName: string; lastName: string; phone: string;
  tierName: string | null; passBalance: PassBalanceItem[];
}

interface CreatedOrder {
  id: string; type: string; destination: string; itemCount: number;
}

interface OpenOrder {
  id: string; type: string; destination: string; status: number;
  items: Array<{ productName: string; quantity: number }>;
}

interface Event {
  id: string; name: string; event_date: string;
}

// ── view states ───────────────────────────────────────────────────────────────
type View =
  | { kind: 'setup' }                                                     // pick event + table
  | { kind: 'order'; eventId: string; tableRef: string;                   // order form
      guest: GuestInfo | null; products: Product[]; openOrders: OpenOrder[] }
  | { kind: 'done'; orders: CreatedOrder[]; tableRef: string };           // confirmation

const TYPE_LABEL: Record<string, string> = { bottle: 'Botella', drink: 'Bebida' };
const DEST_LABEL: Record<string, string> = { warehouse: 'Bodega', bar: 'Bar' };

export default function WaiterPage() {
  const [view, setView] = useState<View>({ kind: 'setup' });

  // setup state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tableRef, setTableRef] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // QR scan (optional)
  const [showQr, setShowQr] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrRef = useRef<HTMLInputElement>(null);

  // order form state
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    get<Event[]>('/events').then(setEvents).catch(() => void 0);
  }, []);

  useEffect(() => {
    if (showQr) setTimeout(() => qrRef.current?.focus(), 50);
  }, [showQr]);

  // ── setup: proceed to order form ─────────────────────────────────────────────
  async function handleSetupContinue(guest: GuestInfo | null) {
    if (!selectedEventId) { setSetupError('Selecciona un evento'); return; }
    if (!tableRef.trim()) { setSetupError('Ingresa número de mesa'); return; }
    setSetupError(null);

    const eventId = guest ? guest.eventId : selectedEventId;
    const [products, openOrders] = await Promise.all([
      get<Product[]>('/products'),
      guest
        ? get<OpenOrder[]>(`/orders?eventId=${eventId}&guestEventId=${guest.guestEventId}&statuses=3,4`)
        : Promise.resolve<OpenOrder[]>([]),
    ]);
    setQuantities({});
    setOrderError(null);
    setView({
      kind: 'order',
      eventId,
      tableRef: tableRef.trim(),
      guest,
      products: products.filter((p) => p.type !== 'shot'),
      openOrders,
    });
  }

  // ── optional QR scan ─────────────────────────────────────────────────────────
  async function handleQrScan(e: React.FormEvent) {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setScanning(true);
    setQrError(null);
    try {
      const guest = await post<GuestInfo>('/orders/lookup', { qr: qrInput.trim() });
      setShowQr(false);
      setQrInput('');
      // Override selected event with guest's event
      setSelectedEventId(guest.eventId);
      await handleSetupContinue(guest);
    } catch (err) {
      setQrError(err instanceof ApiError ? err.message : 'QR inválido');
    } finally {
      setScanning(false);
    }
  }

  // ── submit order ─────────────────────────────────────────────────────────────
  async function handleSubmitOrder() {
    if (view.kind !== 'order') return;
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) { setOrderError('Agrega al menos un producto'); return; }

    setSubmitting(true);
    setOrderError(null);
    try {
      const orders = await post<CreatedOrder[]>('/orders', {
        eventId: view.eventId,
        tableRef: view.tableRef,
        guestEventId: view.guest?.guestEventId,   // undefined = plain table order
        items,
      });
      setView({ kind: 'done', orders, tableRef: view.tableRef });
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Error al crear la orden');
    } finally {
      setSubmitting(false);
    }
  }

  // ── advance open order status ─────────────────────────────────────────────────
  async function advanceOrder(orderId: string, nextStatus: number) {
    if (view.kind !== 'order') return;
    try {
      await patch(`/orders/${orderId}/status`, { status: nextStatus });
      const openOrders = view.guest
        ? await get<OpenOrder[]>(`/orders?eventId=${view.eventId}&guestEventId=${view.guest.guestEventId}&statuses=3,4`)
        : [];
      setView({ ...view, openOrders });
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SETUP SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (view.kind === 'setup') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.title}>Nueva Comanda</h1>

          {/* Event selector */}
          <label style={s.label}>Evento</label>
          <select
            style={s.select}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">— Seleccionar evento —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {new Date(ev.event_date).toLocaleDateString('es-GT')}
              </option>
            ))}
          </select>

          {/* Table number */}
          <label style={{ ...s.label, marginTop: '1rem' }}>Mesa / Área</label>
          <input
            style={s.input}
            value={tableRef}
            onChange={(e) => setTableRef(e.target.value)}
            placeholder="Ej: Mesa 5, VIP 2, Terraza"
          />

          {setupError && <p style={s.error}>{setupError}</p>}

          {/* Primary action — no guest needed */}
          <button
            style={s.btn}
            onClick={() => void handleSetupContinue(null)}
            disabled={!selectedEventId || !tableRef.trim()}
          >
            Continuar sin pase →
          </button>

          {/* Optional: scan pass QR */}
          <button
            style={s.btnSecondary}
            onClick={() => setShowQr((v) => !v)}
          >
            {showQr ? 'Cancelar' : '¿Tiene pase? Escanear QR'}
          </button>

          {showQr && (
            <form onSubmit={handleQrScan} style={{ marginTop: '0.75rem' }}>
              <input
                ref={qrRef}
                style={s.input}
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Escanea o pega el QR del pase"
                autoComplete="off"
              />
              {qrError && <p style={s.error}>{qrError}</p>}
              <button style={{ ...s.btn, marginTop: '0.5rem' }} type="submit" disabled={scanning || !qrInput.trim()}>
                {scanning ? 'Verificando...' : 'Aplicar pase'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ORDER FORM
  // ─────────────────────────────────────────────────────────────────────────────
  if (view.kind === 'order') {
    const { guest, products, openOrders, tableRef: table, eventId } = view;
    const balanceMap = new Map((guest?.passBalance ?? []).map((b) => [b.productId, b]));
    const readyToPickUp = openOrders.filter((o) => o.status === 3);
    const readyToDeliver = openOrders.filter((o) => o.status === 4);
    const eventName = events.find((e) => e.id === eventId)?.name ?? 'Evento';

    return (
      <div style={s.page}>
        <div style={{ ...s.card, maxWidth: '540px' }}>

          {/* Header */}
          <div style={s.orderHeader}>
            <div>
              <div style={s.tableLabel}>{table}</div>
              <div style={s.eventLabel}>{eventName}</div>
            </div>
            <button style={s.resetBtn} onClick={() => setView({ kind: 'setup' })}>← Cambiar</button>
          </div>

          {/* Guest badge — only shown if pass QR was scanned */}
          {guest && (
            <div style={s.guestBadge}>
              <span style={s.guestName}>{guest.firstName} {guest.lastName}</span>
              <span style={s.tierChip}>{guest.tierName ?? 'Sin tier'}</span>
            </div>
          )}

          {/* Open orders awaiting waiter action */}
          {(readyToPickUp.length > 0 || readyToDeliver.length > 0) && (
            <div style={{ ...s.infoBox, borderLeft: '2px solid #ff9f4a', marginBottom: '1rem' }}>
              <div style={s.boxTitle}>Comandas abiertas</div>
              {readyToPickUp.map((o) => (
                <div key={o.id} style={s.openOrderRow}>
                  <span style={{ color: '#ff9f4a', fontSize: '0.78rem', fontWeight: 600 }}>
                    RECOGER en {DEST_LABEL[o.destination] ?? o.destination}
                  </span>
                  <span style={s.openOrderItems}>
                    {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                  </span>
                  <button style={s.miniBtn} onClick={() => void advanceOrder(o.id, 4)}>Recibido</button>
                </div>
              ))}
              {readyToDeliver.map((o) => (
                <div key={o.id} style={s.openOrderRow}>
                  <span style={{ color: '#4caf50', fontSize: '0.78rem', fontWeight: 600 }}>ENTREGAR AL INVITADO</span>
                  <span style={s.openOrderItems}>
                    {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                  </span>
                  <button style={{ ...s.miniBtn, backgroundColor: '#1a3a1a' }} onClick={() => void advanceOrder(o.id, 5)}>Entregado</button>
                </div>
              ))}
            </div>
          )}

          {/* Pass balance — only when guest has a pass */}
          {guest && guest.passBalance.length > 0 && (
            <div style={{ ...s.infoBox, marginBottom: '1rem' }}>
              <div style={s.boxTitle}>Saldo de pase</div>
              <div style={s.balanceGrid}>
                {guest.passBalance.map((b) => (
                  <div key={b.productId} style={s.balanceItem}>
                    <span style={s.balanceName}>{b.productName}</span>
                    <span style={{ ...s.balanceNum, color: b.remaining > 0 ? '#4caf50' : '#555' }}>
                      {b.remaining}/{b.allocated}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product list */}
          <div style={s.label}>Productos</div>
          <div style={s.productList}>
            {products.map((p) => {
              const balance = balanceMap.get(p.id);
              const qty = quantities[p.id] ?? 0;
              return (
                <div key={p.id} style={s.productRow}>
                  <div style={s.productInfo}>
                    <span style={s.productName}>{p.name}</span>
                    <span style={s.typePill}>{TYPE_LABEL[p.type] ?? p.type}</span>
                    {balance && balance.remaining > 0 && (
                      <span style={s.passTag}>Pass: {balance.remaining} disp.</span>
                    )}
                  </div>
                  <div style={s.qtyRow}>
                    <button style={s.qtyBtn} onClick={() => setQuantities((q) => ({ ...q, [p.id]: Math.max(0, (q[p.id] ?? 0) - 1) }))}>−</button>
                    <span style={s.qtyVal}>{qty}</span>
                    <button style={s.qtyBtn} onClick={() => setQuantities((q) => ({ ...q, [p.id]: (q[p.id] ?? 0) + 1 }))}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {orderError && <p style={s.error}>{orderError}</p>}
          <button style={s.btn} onClick={handleSubmitOrder} disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar Comanda'}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DONE SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  const { orders, tableRef: doneTable } = view;
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.doneIcon}>✓</div>
        <h2 style={s.doneTitle}>Comanda enviada</h2>
        <p style={s.doneSub}>{doneTable}</p>
        <div style={s.orderList}>
          {orders.map((o) => (
            <div key={o.id} style={s.orderChip}>
              <span style={{ color: o.type === 'pass' ? '#4caf50' : '#9c6eff', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                {o.type === 'pass' ? 'Pass' : 'Extra'}
              </span>
              <span style={{ color: '#888', fontSize: '0.8rem' }}> → {DEST_LABEL[o.destination] ?? o.destination}</span>
              <span style={{ color: '#aaa', fontSize: '0.8rem' }}> · {o.itemCount} producto{o.itemCount !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
        <button style={s.btn} onClick={() => setView({ kind: 'setup' })}>Nueva comanda</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem' },
  card:         { backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '480px', color: '#f0f0f0' },
  title:        { fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#9c6eff' },
  label:        { fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem', display: 'block' },
  input:        { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.65rem 0.75rem', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select:       { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.65rem 0.75rem', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  error:        { color: '#e55', fontSize: '0.85rem', margin: '0.25rem 0' },
  btn:          { marginTop: '1rem', backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
  btnSecondary: { marginTop: '0.5rem', backgroundColor: 'transparent', color: '#9c6eff', border: '1px solid #9c6eff', borderRadius: '7px', padding: '0.65rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', width: '100%' },
  // order screen
  orderHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  tableLabel:   { fontSize: '1.2rem', fontWeight: 700 },
  eventLabel:   { fontSize: '0.8rem', color: '#888', marginTop: '0.15rem' },
  resetBtn:     { background: 'none', border: '1px solid #3a3a3a', color: '#888', borderRadius: '5px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' },
  guestBadge:   { display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1a1a2a', border: '1px solid #2a2a4a', borderRadius: '7px', padding: '0.5rem 0.75rem', marginBottom: '1rem' },
  guestName:    { fontSize: '0.9rem', fontWeight: 600 },
  tierChip:     { fontSize: '0.72rem', backgroundColor: '#2a1a4a', color: '#9c6eff', borderRadius: '3px', padding: '0.1rem 0.4rem', fontWeight: 600 },
  infoBox:      { backgroundColor: '#111', borderRadius: '8px', padding: '0.75rem 1rem' },
  boxTitle:     { fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 },
  openOrderRow: { display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.4rem 0', borderBottom: '1px solid #2a2a2a' },
  openOrderItems: { color: '#bbb', fontSize: '0.82rem' },
  miniBtn:      { marginTop: '0.25rem', backgroundColor: '#2a2a2a', color: '#f0f0f0', border: 'none', borderRadius: '5px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', alignSelf: 'flex-start' },
  balanceGrid:  { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  balanceItem:  { display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: '5px', padding: '0.3rem 0.6rem' },
  balanceName:  { fontSize: '0.82rem' },
  balanceNum:   { fontSize: '0.82rem', fontWeight: 700 },
  productList:  { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem', marginTop: '0.25rem' },
  productRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: '7px', padding: '0.65rem 0.85rem' },
  productInfo:  { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  productName:  { fontSize: '0.9rem', fontWeight: 500 },
  typePill:     { fontSize: '0.72rem', color: '#888', backgroundColor: '#2a2a2a', borderRadius: '3px', padding: '0.1rem 0.35rem' },
  passTag:      { fontSize: '0.72rem', color: '#4caf50', backgroundColor: '#1a2a1a', borderRadius: '3px', padding: '0.1rem 0.35rem' },
  qtyRow:       { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  qtyBtn:       { width: '28px', height: '28px', borderRadius: '5px', border: '1px solid #3a3a3a', backgroundColor: '#2a2a2a', color: '#f0f0f0', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal:       { width: '24px', textAlign: 'center', fontSize: '0.95rem', fontWeight: 600 },
  // done screen
  doneIcon:     { fontSize: '2.5rem', color: '#4caf50', textAlign: 'center', marginBottom: '0.5rem' },
  doneTitle:    { textAlign: 'center', margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: 700 },
  doneSub:      { textAlign: 'center', color: '#888', margin: '0 0 1rem', fontSize: '0.9rem' },
  orderList:    { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' },
  orderChip:    { backgroundColor: '#111', borderRadius: '6px', padding: '0.5rem 0.75rem' },
};
