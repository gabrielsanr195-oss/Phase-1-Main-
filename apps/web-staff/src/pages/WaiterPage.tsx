import { useState, useEffect, useRef } from 'react';
import { get, post, ApiError } from '../api/client';

interface Product {
  id: string; name: string; type: 'bottle' | 'drink' | 'shot'; sku: string | null;
}

interface PassBalanceItem {
  productId: string; productName: string; productType: string;
  allocated: number; consumed: number; remaining: number;
}

interface GuestLookup {
  guestEventId: string; eventId: string; status: string;
  firstName: string; lastName: string; phone: string;
  tierName: string | null; passBalance: PassBalanceItem[];
}

interface CreatedOrder {
  id: string; type: string; destination: string; itemCount: number;
}

type ViewState =
  | { kind: 'scan' }
  | { kind: 'order'; guest: GuestLookup; products: Product[] }
  | { kind: 'done'; orders: CreatedOrder[]; guest: GuestLookup };

const TYPE_LABEL: Record<string, string> = { bottle: 'Botella', drink: 'Bebida', shot: 'Shot' };
const DEST_LABEL: Record<string, string> = { warehouse: 'Bodega', bar: 'Bar' };

export default function WaiterPage() {
  const [view, setView] = useState<ViewState>({ kind: 'scan' });
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quantities per product for the order form
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tableRef, setTableRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (view.kind === 'scan') {
      setQrInput('');
      setScanError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [view.kind]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setScanning(true);
    setScanError(null);
    try {
      const [guest, products] = await Promise.all([
        post<GuestLookup>('/orders/lookup', { qr: qrInput.trim() }),
        get<Product[]>('/products'),
      ]);
      if (guest.status !== 'checked_in') {
        setScanError(`Invitado en estado "${guest.status}" — debe haber hecho check-in primero`);
        return;
      }
      setQuantities({});
      setTableRef('');
      setOrderError(null);
      setView({ kind: 'order', guest, products: products.filter((p) => p.type !== 'shot') });
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : 'QR inválido');
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmitOrder() {
    if (view.kind !== 'order') return;
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      setOrderError('Agrega al menos un producto');
      return;
    }
    setSubmitting(true);
    setOrderError(null);
    try {
      const orders = await post<CreatedOrder[]>('/orders', {
        guestEventId: view.guest.guestEventId,
        eventId: view.guest.eventId,
        items,
        tableRef: tableRef || undefined,
      });
      setView({ kind: 'done', orders, guest: view.guest });
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Error al crear la orden');
    } finally {
      setSubmitting(false);
    }
  }

  if (view.kind === 'scan') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.title}>Mesero — Escanear QR</h1>
          <form onSubmit={handleScan} style={s.form}>
            <label style={s.label}>QR del invitado</label>
            <input
              ref={inputRef}
              style={s.input}
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Escanea o pega el QR"
              autoComplete="off"
            />
            {scanError && <p style={s.error}>{scanError}</p>}
            <button style={s.btn} type="submit" disabled={scanning || !qrInput.trim()}>
              {scanning ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view.kind === 'order') {
    const { guest, products } = view;
    const balanceMap = new Map(guest.passBalance.map((b) => [b.productId, b]));

    return (
      <div style={s.page}>
        <div style={{ ...s.card, maxWidth: '540px' }}>
          {/* Guest header */}
          <div style={s.guestHeader}>
            <div>
              <div style={s.guestName}>{guest.firstName} {guest.lastName}</div>
              <div style={s.guestSub}>{guest.tierName ?? 'Sin tier'} · {guest.phone}</div>
            </div>
            <button style={s.resetBtn} onClick={() => setView({ kind: 'scan' })}>× Cambiar</button>
          </div>

          {/* Pass balance summary */}
          {guest.passBalance.length > 0 && (
            <div style={s.balanceBox}>
              <div style={s.balanceTitle}>Saldo de pass</div>
              <div style={s.balanceGrid}>
                {guest.passBalance.map((b) => (
                  <div key={b.productId} style={s.balanceItem}>
                    <span style={s.balanceName}>{b.productName}</span>
                    <span style={{ ...s.balanceNum, color: b.remaining > 0 ? '#4caf50' : '#666' }}>
                      {b.remaining}/{b.allocated}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table ref */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={s.label}>Mesa / Área (opcional)</label>
            <input style={s.input} value={tableRef} onChange={(e) => setTableRef(e.target.value)} placeholder="Ej: Mesa 5" />
          </div>

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
                    <span style={s.productType}>{TYPE_LABEL[p.type]}</span>
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

  // done
  const { orders, guest } = view;
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.doneIcon}>✓</div>
        <h2 style={s.doneTitle}>Comanda enviada</h2>
        <p style={s.doneSub}>{guest.firstName} {guest.lastName}</p>
        <div style={s.orderList}>
          {orders.map((o) => (
            <div key={o.id} style={s.orderChip}>
              <span style={{ color: o.type === 'pass' ? '#4caf50' : '#d4af37', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                {o.type === 'pass' ? 'Pass' : 'Extra'}
              </span>
              <span style={{ color: '#888', fontSize: '0.8rem' }}> → {DEST_LABEL[o.destination] ?? o.destination}</span>
              <span style={{ color: '#aaa', fontSize: '0.8rem' }}> · {o.itemCount} producto{o.itemCount !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
        <button style={s.btn} onClick={() => setView({ kind: 'scan' })}>Nueva comanda</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '480px', color: '#f0f0f0' },
  title: { fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#9c6eff' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem', display: 'block' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.65rem 0.75rem', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  error: { color: '#e55', fontSize: '0.85rem', margin: '0.25rem 0' },
  btn: { marginTop: '1rem', backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
  guestHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  guestName: { fontSize: '1.1rem', fontWeight: 700 },
  guestSub: { fontSize: '0.82rem', color: '#888', marginTop: '0.15rem' },
  resetBtn: { background: 'none', border: '1px solid #3a3a3a', color: '#888', borderRadius: '5px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' },
  balanceBox: { backgroundColor: '#111', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' },
  balanceTitle: { fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 },
  balanceGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  balanceItem: { display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: '5px', padding: '0.3rem 0.6rem' },
  balanceName: { fontSize: '0.82rem' },
  balanceNum: { fontSize: '0.82rem', fontWeight: 700 },
  productList: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' },
  productRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: '7px', padding: '0.65rem 0.85rem' },
  productInfo: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  productName: { fontSize: '0.9rem', fontWeight: 500 },
  productType: { fontSize: '0.72rem', color: '#888', backgroundColor: '#2a2a2a', borderRadius: '3px', padding: '0.1rem 0.35rem' },
  passTag: { fontSize: '0.72rem', color: '#4caf50', backgroundColor: '#1a2a1a', borderRadius: '3px', padding: '0.1rem 0.35rem' },
  qtyRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  qtyBtn: { width: '28px', height: '28px', borderRadius: '5px', border: '1px solid #3a3a3a', backgroundColor: '#2a2a2a', color: '#f0f0f0', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { width: '24px', textAlign: 'center', fontSize: '0.95rem', fontWeight: 600 },
  doneIcon: { fontSize: '2.5rem', color: '#4caf50', textAlign: 'center', marginBottom: '0.5rem' },
  doneTitle: { textAlign: 'center', margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: 700 },
  doneSub: { textAlign: 'center', color: '#888', margin: '0 0 1rem', fontSize: '0.9rem' },
  orderList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' },
  orderChip: { backgroundColor: '#111', borderRadius: '6px', padding: '0.5rem 0.75rem' },
};
