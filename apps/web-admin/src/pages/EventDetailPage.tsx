import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get, post, patch, del, ApiError } from '../api/client';

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
interface Product {
  id: string; name: string; type: 'bottle' | 'drink' | 'shot'; sku: string | null; is_active: boolean;
}
interface PassTierItem {
  id: string; product_id: string; product_name: string; product_type: string;
  quantity: number; pass_tier_id: string;
}
interface GuestEvent {
  id: string; status: string; invited_at: string; qr_token: string | null;
  first_name: string; last_name: string; phone: string; gender: string;
  tier_name: string | null; price: string | null; currency: string | null;
}

type Tab = 'guests' | 'pass-tiers' | 'products';

const PHASE_ORDER = ['phase_0', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'closed'];
const PHASE_LABEL: Record<string, string> = {
  phase_0: 'Fase 0', phase_1: 'Fase 1', phase_2: 'Fase 2',
  phase_3: 'Fase 3', phase_4: 'Fase 4', closed: 'Cerrado',
};
const PHASE_COLOR: Record<string, string> = {
  phase_0: '#888', phase_1: '#4a9eff', phase_2: '#9c6eff',
  phase_3: '#ff9f4a', phase_4: '#ff4a6e', closed: '#555',
};

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
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tierItems, setTierItems] = useState<Record<string, PassTierItem[]>>({});
  const [newProduct, setNewProduct] = useState({ name: '', type: 'drink' as Product['type'], sku: '' });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [addItemState, setAddItemState] = useState<Record<string, { productId: string; quantity: string }>>({});

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [ev, ts, gs, prods] = await Promise.all([
      get<Event>(`/events/${id}`),
      get<PassTier[]>(`/events/${id}/pass-tiers`),
      get<GuestEvent[]>(`/guests?eventId=${id}`),
      get<Product[]>('/products'),
    ]);
    setEvent(ev);
    setTiers(ts);
    setGuests(gs);
    setProducts(prods);
    // Load tier items for each tier
    const items: Record<string, PassTierItem[]> = {};
    await Promise.all(
      ts.map(async (t) => {
        items[t.id] = await get<PassTierItem[]>(`/products/pass-tiers/${t.id}/items`);
      }),
    );
    setTierItems(items);
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function advancePhase() {
    if (!event || !id) return;
    const nextIdx = PHASE_ORDER.indexOf(event.status) + 1;
    const next = PHASE_ORDER[nextIdx];
    if (!next) return;
    setPhaseLoading(true);
    setPhaseError(null);
    try {
      await patch(`/events/${id}/status`, { status: next });
      await fetchAll();
    } catch (err) {
      setPhaseError(err instanceof ApiError ? err.message : 'Error al avanzar fase');
    } finally {
      setPhaseLoading(false);
    }
  }

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

  // Capacity / ratio stats
  const confirmedGuests = guests.filter((g) => !['rejected', 'en_lista'].includes(g.status));
  const confirmedTotal = confirmedGuests.length;
  const confirmedWomen = confirmedGuests.filter((g) => g.gender === 'female').length;
  const confirmedMen = confirmedGuests.filter((g) => g.gender === 'male').length;
  const enListaTotal = guests.filter((g) => g.status === 'en_lista').length;
  const enListaWomen = guests.filter((g) => g.status === 'en_lista' && g.gender === 'female').length;
  const enListaMen = guests.filter((g) => g.status === 'en_lista' && g.gender === 'male').length;
  const ratioTarget = parseFloat(event.ratio_target_women) || 0;
  const currentRatio = confirmedTotal > 0 ? confirmedWomen / confirmedTotal : 0;
  const availableSpots = Math.max(0, event.total_pax - event.reserved_spots - confirmedTotal);
  const ratioOk = currentRatio >= ratioTarget;

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
        <div style={s.rightCol}>
          <div style={s.statBox}>
            <div style={s.stat}><span style={s.statVal}>{guests.length}</span><span style={s.statLbl}>Invitados</span></div>
            <div style={s.stat}><span style={s.statVal}>{event.total_pax}</span><span style={s.statLbl}>Capacidad</span></div>
            <div style={s.stat}>
              <span style={s.statVal}>{guests.filter((g) => g.status === 'paid' || g.status === 'checked_in').length}</span>
              <span style={s.statLbl}>Pagados</span>
            </div>
          </div>
          <div style={s.phaseRow}>
            <span style={{ ...s.phaseBadge, backgroundColor: PHASE_COLOR[event.status] ?? '#555' }}>
              {PHASE_LABEL[event.status] ?? event.status}
            </span>
            {event.status !== 'closed' && (
              <button style={s.advanceBtn} onClick={() => void advancePhase()} disabled={phaseLoading}>
                {phaseLoading ? '...' : `→ ${PHASE_LABEL[PHASE_ORDER[PHASE_ORDER.indexOf(event.status) + 1] ?? ''] ?? ''}`}
              </button>
            )}
          </div>
          {phaseError && <p style={s.phaseError}>{phaseError}</p>}
        </div>
      </div>

      {/* Capacity & Ratio Dashboard */}
      <div style={s.ratioDash}>
        <div style={s.ratioBlock}>
          <div style={s.ratioTitle}>Cupo disponible</div>
          <div style={{ ...s.ratioVal, color: availableSpots < 10 ? '#e55' : '#4caf50' }}>{availableSpots}</div>
          <div style={s.ratioSub}>de {event.total_pax} ({event.reserved_spots} reservados)</div>
        </div>
        <div style={s.ratioBlock}>
          <div style={s.ratioTitle}>Confirmados</div>
          <div style={s.ratioVal}>{confirmedTotal}</div>
          <div style={s.ratioSub}>
            <span style={{ color: '#e97fa8' }}>♀ {confirmedWomen}</span>
            {confirmedTotal > 0 ? ` (${Math.round(confirmedWomen / confirmedTotal * 100)}%)` : ''}
            {'  '}
            <span style={{ color: '#7ab3ff' }}>♂ {confirmedMen}</span>
            {confirmedTotal > 0 ? ` (${Math.round(confirmedMen / confirmedTotal * 100)}%)` : ''}
          </div>
        </div>
        <div style={s.ratioBlock}>
          <div style={s.ratioTitle}>Ratio mujeres</div>
          <div style={{ ...s.ratioVal, color: ratioOk ? '#4caf50' : '#e55' }}>
            {Math.round(currentRatio * 100)}%
          </div>
          <div style={s.ratioSub}>objetivo: {Math.round(ratioTarget * 100)}% {ratioOk ? '✓' : '⚠'}</div>
        </div>
        <div style={s.ratioBlock}>
          <div style={s.ratioTitle}>En lista</div>
          <div style={s.ratioVal}>{enListaTotal}</div>
          <div style={s.ratioSub}>
            <span style={{ color: '#e97fa8' }}>♀ {enListaWomen}</span>
            {'  '}
            <span style={{ color: '#7ab3ff' }}>♂ {enListaMen}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={{ ...s.tabBtn, ...(tab === 'guests' ? s.tabActive : {}) }} onClick={() => setTab('guests')}>
          Invitados ({guests.length})
        </button>
        <button style={{ ...s.tabBtn, ...(tab === 'pass-tiers' ? s.tabActive : {}) }} onClick={() => setTab('pass-tiers')}>
          Pass Tiers ({tiers.length})
        </button>
        <button style={{ ...s.tabBtn, ...(tab === 'products' ? s.tabActive : {}) }} onClick={() => setTab('products')}>
          Productos ({products.length})
        </button>
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

      {/* Products tab */}
      {tab === 'products' && (
        <ProductsTab
          products={products}
          tiers={tiers}
          tierItems={tierItems}
          newProduct={newProduct}
          setNewProduct={setNewProduct}
          showForm={showProductForm}
          setShowForm={setShowProductForm}
          savingProduct={savingProduct}
          productError={productError}
          addItemState={addItemState}
          setAddItemState={setAddItemState}
          onCreateProduct={async (e) => {
            e.preventDefault();
            setSavingProduct(true);
            setProductError(null);
            try {
              await post('/products', { name: newProduct.name, type: newProduct.type, sku: newProduct.sku || undefined });
              setNewProduct({ name: '', type: 'drink', sku: '' });
              setShowProductForm(false);
              await fetchAll();
            } catch (err) {
              setProductError(err instanceof ApiError ? err.message : 'Error');
            } finally {
              setSavingProduct(false);
            }
          }}
          onAddTierItem={async (tierId) => {
            const s = addItemState[tierId];
            if (!s?.productId || !s.quantity) return;
            try {
              await post(`/products/pass-tiers/${tierId}/items`, {
                productId: s.productId,
                quantity: parseInt(s.quantity, 10),
              });
              setAddItemState((prev) => ({ ...prev, [tierId]: { productId: '', quantity: '' } }));
              await fetchAll();
            } catch (err) {
              setProductError(err instanceof ApiError ? err.message : 'Error');
            }
          }}
          onRemoveTierItem={async (tierId, productId) => {
            try {
              await del(`/products/pass-tiers/${tierId}/items/${productId}`);
              await fetchAll();
            } catch (err) {
              setProductError(err instanceof ApiError ? err.message : 'Error');
            }
          }}
        />
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

const TYPE_LABEL: Record<string, string> = { bottle: 'Botella', drink: 'Bebida', shot: 'Shot' };
const TYPE_COLOR: Record<string, string> = { bottle: '#d4af37', drink: '#4a9eff', shot: '#9c6eff' };

function ProductsTab({
  products, tiers, tierItems, newProduct, setNewProduct, showForm, setShowForm,
  savingProduct, productError, addItemState, setAddItemState,
  onCreateProduct, onAddTierItem, onRemoveTierItem,
}: {
  products: Product[];
  tiers: PassTier[];
  tierItems: Record<string, PassTierItem[]>;
  newProduct: { name: string; type: Product['type']; sku: string };
  setNewProduct: React.Dispatch<React.SetStateAction<{ name: string; type: Product['type']; sku: string }>>;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  savingProduct: boolean;
  productError: string | null;
  addItemState: Record<string, { productId: string; quantity: string }>;
  setAddItemState: React.Dispatch<React.SetStateAction<Record<string, { productId: string; quantity: string }>>>;
  onCreateProduct: (e: React.FormEvent) => void;
  onAddTierItem: (tierId: string) => void;
  onRemoveTierItem: (tierId: string, productId: string) => void;
}) {
  return (
    <div>
      {/* Product catalog */}
      <div style={s.sectionHeader}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Catálogo de productos</span>
        <button style={s.primaryBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Agregar producto'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={onCreateProduct} style={s.formInline}>
          <input style={s.input} placeholder="Nombre" value={newProduct.name}
            onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} required />
          <select style={{ ...s.input, flex: 'none', width: '120px' }} value={newProduct.type}
            onChange={(e) => setNewProduct((p) => ({ ...p, type: e.target.value as Product['type'] }))}>
            <option value="drink">Bebida</option>
            <option value="bottle">Botella</option>
            <option value="shot">Shot</option>
          </select>
          <input style={{ ...s.input, width: '100px' }} placeholder="SKU" value={newProduct.sku}
            onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))} />
          {productError && <span style={{ color: '#e55', fontSize: '0.85rem' }}>{productError}</span>}
          <button style={s.primaryBtn} type="submit" disabled={savingProduct}>{savingProduct ? '...' : 'Guardar'}</button>
        </form>
      )}
      <div style={s.productCatalog}>
        {products.length === 0
          ? <p style={{ color: '#666' }}>Sin productos aún.</p>
          : products.map((p) => (
            <div key={p.id} style={s.productChip}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ ...s.typeBadge, backgroundColor: TYPE_COLOR[p.type] ?? '#555' }}>
                {TYPE_LABEL[p.type]}
              </span>
              {p.sku && <span style={{ color: '#666', fontSize: '0.78rem' }}>{p.sku}</span>}
            </div>
          ))
        }
      </div>

      {/* Pass tier items */}
      {tiers.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '1rem' }}>Contenido de pass tiers</div>
          {tiers.map((tier) => {
            const items = tierItems[tier.id] ?? [];
            const addState = addItemState[tier.id] ?? { productId: '', quantity: '' };
            return (
              <div key={tier.id} style={s.tierBundle}>
                <div style={s.tierBundleHeader}>
                  <span style={{ fontWeight: 700 }}>{tier.name}</span>
                  <span style={{ color: '#888', fontSize: '0.82rem' }}>{tier.currency} {parseFloat(tier.price).toFixed(2)}</span>
                </div>
                {items.length > 0 && (
                  <div style={s.tierItemList}>
                    {items.map((item) => (
                      <div key={item.id} style={s.tierItemRow}>
                        <span style={{ ...s.typeBadge, backgroundColor: TYPE_COLOR[item.product_type] ?? '#555' }}>
                          {TYPE_LABEL[item.product_type]}
                        </span>
                        <span>{item.product_name}</span>
                        <span style={{ color: '#d4af37', fontWeight: 700 }}>×{item.quantity}</span>
                        <button style={s.removeBtn} onClick={() => onRemoveTierItem(tier.id, item.product_id)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {products.length > 0 && (
                  <div style={s.addItemRow}>
                    <select style={{ ...s.input, flex: 1, fontSize: '0.82rem', padding: '0.4rem' }}
                      value={addState.productId}
                      onChange={(e) => setAddItemState((prev) => ({ ...prev, [tier.id]: { ...addState, productId: e.target.value } }))}>
                      <option value="">Selecciona producto</option>
                      {products.filter((p) => !items.find((i) => i.product_id === p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({TYPE_LABEL[p.type]})</option>
                      ))}
                    </select>
                    <input style={{ ...s.input, width: '70px', fontSize: '0.82rem', padding: '0.4rem' }}
                      type="number" min="1" placeholder="Cant."
                      value={addState.quantity}
                      onChange={(e) => setAddItemState((prev) => ({ ...prev, [tier.id]: { ...addState, quantity: e.target.value } }))} />
                    <button style={{ ...s.primaryBtn, padding: '0.4rem 0.75rem', marginTop: 0 }}
                      onClick={() => onAddTierItem(tier.id)}
                      disabled={!addState.productId || !addState.quantity}>
                      + Agregar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backLink: { color: '#888', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block', marginBottom: '1.25rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' },
  h1: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 },
  subtitle: { color: '#888', margin: '0 0 0.5rem', fontSize: '0.9rem' },
  desc: { color: '#bbb', margin: 0, fontSize: '0.9rem' },
  rightCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' },
  statBox: { display: 'flex', gap: '1.5rem' },
  phaseRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  phaseBadge: { fontSize: '0.75rem', fontWeight: 700, borderRadius: '5px', padding: '0.25rem 0.6rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' },
  advanceBtn: { backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#f0f0f0', borderRadius: '5px', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 },
  phaseError: { color: '#e55', fontSize: '0.8rem', margin: 0 },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statVal: { fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 },
  statLbl: { fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' },
  ratioDash: { display: 'flex', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#111', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem' },
  ratioBlock: { flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  ratioTitle: { fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  ratioVal: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 },
  ratioSub: { fontSize: '0.78rem', color: '#999' },
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
  productCatalog: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' },
  productChip: { display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1a1a1a', borderRadius: '7px', padding: '0.5rem 0.75rem', fontSize: '0.88rem' },
  typeBadge: { fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', padding: '0.15rem 0.4rem', color: '#fff', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tierBundle: { backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '0.9rem 1rem', marginBottom: '0.75rem' },
  tierBundleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' },
  tierItemList: { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem', marginBottom: '0.6rem' },
  tierItemRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, marginLeft: 'auto' },
  addItemRow: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' as const },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.75rem', color: '#888', fontWeight: 500, borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #1a1a1a' },
  td: { padding: '0.7rem 0.75rem', verticalAlign: 'middle' },
  badge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', padding: '0.2rem 0.5rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' },
};
