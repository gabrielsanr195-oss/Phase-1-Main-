import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post, ApiError } from '../api/client';

interface ShareLinkInfo {
  event_name: string;
  event_description: string | null;
  event_date: string;
  event_status: string;
  tier_name: string;
  tier_description: string | null;
  price: string;
  currency: string;
}

interface RegistrationForm {
  firstName: string;
  lastName: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | '';
  dateOfBirth: string;
  whatsappOptIn: boolean;
}

const INITIAL_FORM: RegistrationForm = {
  firstName: '',
  lastName: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
  whatsappOptIn: false,
};

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [linkInfo, setLinkInfo] = useState<ShareLinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    get<ShareLinkInfo>(`/share-links/${token}`)
      .then(setLinkInfo)
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load event info');
      });
  }, [token]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.gender) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await post(`/register/${token}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        gender: form.gender,
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        whatsappOptIn: form.whatsappOptIn,
      });
      navigate(`/r/${token}/done`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.errorTitle}>Link inválido</h2>
          <p style={styles.errorText}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!linkInfo) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loading}>Cargando...</p>
        </div>
      </div>
    );
  }

  const eventDate = new Date(linkInfo.event_date).toLocaleDateString('es-GT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.eventHeader}>
          <h1 style={styles.eventName}>{linkInfo.event_name}</h1>
          <p style={styles.eventDate}>{eventDate}</p>
          {linkInfo.event_description && (
            <p style={styles.eventDescription}>{linkInfo.event_description}</p>
          )}
          <div style={styles.tierBadge}>
            <span style={styles.tierName}>{linkInfo.tier_name}</span>
            <span style={styles.tierPrice}>
              {linkInfo.currency} {parseFloat(linkInfo.price).toFixed(2)}
            </span>
          </div>
        </div>

        <hr style={styles.divider} />

        <h2 style={styles.formTitle}>Registro de invitado</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Nombre *</label>
              <input
                style={styles.input}
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                placeholder="Juan"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Apellido *</label>
              <input
                style={styles.input}
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                placeholder="Pérez"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Teléfono (WhatsApp) *</label>
            <input
              style={styles.input}
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder="+502 5555 5555"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Género *</label>
            <select
              style={styles.input}
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar...</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Fecha de nacimiento</label>
            <input
              style={styles.input}
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
            />
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="whatsappOptIn"
              checked={form.whatsappOptIn}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Acepto recibir información por WhatsApp
          </label>

          {submitError && <p style={styles.errorText}>{submitError}</p>}

          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Confirmar registro'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f0f0f',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '2rem',
    width: '100%',
    maxWidth: '480px',
    color: '#f0f0f0',
  },
  eventHeader: { marginBottom: '1.5rem' },
  eventName: { fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.25rem' },
  eventDate: { color: '#aaa', margin: '0 0 0.75rem', fontSize: '0.95rem' },
  eventDescription: { color: '#ccc', fontSize: '0.9rem', margin: '0 0 1rem' },
  tierBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '0.4rem 0.85rem',
  },
  tierName: { fontWeight: 600, fontSize: '0.9rem' },
  tierPrice: { color: '#d4af37', fontWeight: 700, fontSize: '0.95rem' },
  divider: { border: 'none', borderTop: '1px solid #2a2a2a', margin: '1.5rem 0' },
  formTitle: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 },
  label: { fontSize: '0.85rem', color: '#aaa' },
  input: {
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    color: '#f0f0f0',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#ccc', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#d4af37' },
  button: {
    backgroundColor: '#d4af37',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '0.85rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  loading: { textAlign: 'center', color: '#aaa' },
  errorTitle: { color: '#e55', margin: '0 0 0.5rem' },
  errorText: { color: '#e55', fontSize: '0.9rem' },
};
