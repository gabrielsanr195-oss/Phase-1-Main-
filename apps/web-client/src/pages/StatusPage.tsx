import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { get, ApiError } from '../api/client';

interface StatusData {
  id: string;
  status: string;
  qr_token: string | null;
  invitation_expires_at: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  first_name: string;
  last_name: string;
  event_name: string;
  event_date: string;
  tier_name: string | null;
  price: string | null;
  currency: string | null;
}

const STATUS_INFO: Record<string, { label: string; color: string; description: string }> = {
  en_lista: { label: 'En lista', color: '#4a9eff', description: 'Tu solicitud fue recibida. Pronto será revisada.' },
  confirmed: { label: 'Confirmado', color: '#4caf50', description: 'Tu invitación está confirmada. Pendiente de pago.' },
  rejected: { label: 'Rechazado', color: '#e55', description: 'Tu solicitud no fue aprobada en esta ocasión.' },
  paid: { label: 'Pagado — QR listo', color: '#d4af37', description: 'Muestra este QR en la puerta del evento.' },
  checked_in: { label: 'Adentro', color: '#9c6eff', description: 'Check-in completado. ¡Disfruta el evento!' },
  checked_out: { label: 'Salida', color: '#666', description: 'Check-out registrado.' },
};

const STORAGE_KEY = (token: string) => `phase1plus_phone_${token}`;

export default function StatusPage() {
  const { token } = useParams<{ token: string }>();
  const [phone, setPhone] = useState(() => (token ? (localStorage.getItem(STORAGE_KEY(token)) ?? '') : ''));
  const [phoneInput, setPhoneInput] = useState(phone);
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (phone && token && !searched) {
      void fetchStatus(phone);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStatus(ph: string) {
    if (!token) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await get<StatusData>(`/register/${token}/status?phone=${encodeURIComponent(ph)}`);
      setData(result);
      localStorage.setItem(STORAGE_KEY(token), ph);
      setPhone(ph);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo obtener el estado');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void fetchStatus(phoneInput);
  }

  const info = data ? (STATUS_INFO[data.status] ?? { label: data.status, color: '#888', description: '' }) : null;

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>Estado de registro</h1>

        {!data && (
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.label}>Ingresa tu número de teléfono para ver tu estado</label>
            <input
              style={s.input}
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+502 5555 5555"
              required
            />
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Buscando...' : 'Ver estado'}
            </button>
          </form>
        )}

        {data && info && (
          <div style={s.result}>
            <div style={s.guestName}>{data.first_name} {data.last_name}</div>
            <div style={s.eventName}>{data.event_name}</div>
            <div style={s.eventDate}>
              {new Date(data.event_date).toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {data.tier_name && (
              <div style={s.tier}>{data.tier_name} — {data.currency} {data.price ? parseFloat(data.price).toFixed(2) : ''}</div>
            )}

            <div style={{ ...s.statusBadge, backgroundColor: info.color }}>
              {info.label}
            </div>
            <p style={s.statusDesc}>{info.description}</p>

            {data.status === 'paid' && data.qr_token && (
              <div style={s.qrWrap}>
                <p style={s.qrLabel}>Tu código QR de acceso</p>
                <div style={s.qrBox}>
                  <QRCodeSVG value={data.qr_token} size={220} bgColor="#fff" fgColor="#000" level="M" />
                </div>
                <p style={s.qrHint}>Presenta este código en la puerta. No compartas capturas de pantalla.</p>
              </div>
            )}

            {data.invitation_expires_at && data.status === 'en_lista' && (
              <p style={s.expiry}>
                Expira: {new Date(data.invitation_expires_at).toLocaleDateString('es-GT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            <button style={s.resetBtn} onClick={() => { setData(null); setSearched(false); }}>
              Buscar otro número
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem' },
  card: { backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '440px', color: '#f0f0f0' },
  title: { fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label: { fontSize: '0.9rem', color: '#aaa' },
  input: { backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '0.65rem 0.75rem', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none' },
  btn: { backgroundColor: '#d4af37', color: '#000', border: 'none', borderRadius: '7px', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' },
  error: { color: '#e55', fontSize: '0.85rem', margin: 0 },
  result: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  guestName: { fontSize: '1.35rem', fontWeight: 700 },
  eventName: { fontWeight: 600, fontSize: '1rem', color: '#ccc' },
  eventDate: { color: '#888', fontSize: '0.85rem' },
  tier: { color: '#d4af37', fontSize: '0.9rem', fontWeight: 600 },
  statusBadge: { display: 'inline-block', alignSelf: 'flex-start', borderRadius: '6px', padding: '0.35rem 0.8rem', fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginTop: '0.5rem' },
  statusDesc: { color: '#aaa', fontSize: '0.9rem', margin: 0 },
  qrWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' },
  qrLabel: { margin: 0, fontWeight: 600, fontSize: '0.95rem' },
  qrBox: { backgroundColor: '#fff', padding: '1rem', borderRadius: '10px', display: 'flex' },
  qrHint: { color: '#888', fontSize: '0.78rem', textAlign: 'center', margin: 0 },
  expiry: { color: '#ff9f4a', fontSize: '0.82rem', margin: 0 },
  resetBtn: { marginTop: '0.75rem', background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' },
};
