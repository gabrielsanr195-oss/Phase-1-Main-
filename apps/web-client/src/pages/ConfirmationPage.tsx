import { useParams, Link } from 'react-router-dom';

export default function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>✓</div>
        <h1 style={styles.title}>¡Registro completado!</h1>
        <p style={styles.body}>
          Tu solicitud fue recibida. Serás notificado cuando tu acceso sea confirmado.
        </p>
        {token && (
          <Link to={`/r/${token}/status`} style={styles.statusLink}>
            Ver estado de mi registro →
          </Link>
        )}
        {token && (
          <p style={styles.tokenDisplay}>
            Código: <code style={styles.code}>{token}</code>
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '420px',
    color: '#f0f0f0',
    textAlign: 'center',
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#1a3a1a',
    color: '#4caf50',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  },
  title: { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.75rem' },
  body: { color: '#ccc', lineHeight: 1.6, margin: '0 0 1rem' },
  hint: { color: '#888', fontSize: '0.85rem', margin: '0 0 1.25rem' },
  statusLink: { display: 'inline-block', marginBottom: '1rem', color: '#d4af37', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' },
  tokenDisplay: { fontSize: '0.85rem', color: '#888' },
  code: {
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    padding: '0.15rem 0.4rem',
    color: '#d4af37',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
  },
};
