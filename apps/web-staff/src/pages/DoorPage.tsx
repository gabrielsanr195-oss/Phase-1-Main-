import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ScanResult {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  gender: string;
  tier_name: string | null;
  status: string;
  checked_in_at: string | null;
  checkInResult: 'success' | 'already_in';
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: ScanResult }
  | { kind: 'error'; message: string };

const GENDER_LABEL: Record<string, string> = { male: 'M', female: 'F', other: 'Otro' };

export default function DoorPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [qrInput, setQrInput] = useState('');
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [state]);

  async function handleScan(token: string) {
    if (!token.trim()) return;
    setState({ kind: 'loading' });
    try {
      const data = await post<ScanResult>('/door/scan', { qrToken: token.trim() });
      setState({ kind: 'success', data });
      setQrInput('');
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Error de escaneo' });
      setQrInput('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void handleScan(qrInput);
    }
  }

  function handleReset() {
    setState({ kind: 'idle' });
    setQrInput('');
    inputRef.current?.focus();
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.brand}>Puerta</span>
        <span style={s.staffName}>{user?.firstName} {user?.lastName}</span>
        <button style={s.logoutBtn} onClick={handleLogout}>Salir</button>
      </div>

      <div style={s.content}>
        {state.kind !== 'success' && state.kind !== 'error' && (
          <div style={s.scanArea}>
            <p style={s.instruction}>
              {state.kind === 'loading' ? 'Verificando...' : 'Escanea o pega el código QR'}
            </p>
            <input
              ref={inputRef}
              style={s.qrInput}
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="QR token..."
              disabled={state.kind === 'loading'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {qrInput && (
              <button style={s.scanBtn} onClick={() => void handleScan(qrInput)} disabled={state.kind === 'loading'}>
                Verificar
              </button>
            )}
          </div>
        )}

        {state.kind === 'success' && (
          <div style={{ ...s.resultCard, borderColor: state.data.checkInResult === 'already_in' ? '#ff9f4a' : '#4caf50' }}>
            <div style={s.resultIcon}>
              {state.data.checkInResult === 'already_in' ? '⚠' : '✓'}
            </div>
            <div style={s.guestName}>
              {state.data.first_name} {state.data.last_name}
            </div>
            <div style={s.guestMeta}>
              <span>{GENDER_LABEL[state.data.gender] ?? state.data.gender}</span>
              {state.data.tier_name && <span style={s.tierTag}>{state.data.tier_name}</span>}
            </div>
            {state.data.checkInResult === 'already_in' && (
              <p style={s.alreadyIn}>Ya hizo check-in anteriormente</p>
            )}
            {state.data.checked_in_at && (
              <p style={s.checkinTime}>
                {new Date(state.data.checked_in_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button style={s.nextBtn} onClick={handleReset}>Siguiente</button>
          </div>
        )}

        {state.kind === 'error' && (
          <div style={s.errorCard}>
            <div style={s.errorIcon}>✗</div>
            <p style={s.errorMsg}>{state.message}</p>
            <button style={s.nextBtn} onClick={handleReset}>Intentar de nuevo</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#f0f0f0', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid #1a1a1a', backgroundColor: '#111' },
  brand: { fontWeight: 700, color: '#9c6eff', fontSize: '1rem', flex: 1 },
  staffName: { fontSize: '0.85rem', color: '#aaa' },
  logoutBtn: { background: 'none', border: '1px solid #333', color: '#888', borderRadius: '5px', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem' },
  content: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' },
  scanArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%', maxWidth: '440px' },
  instruction: { color: '#888', fontSize: '1rem', margin: 0, textAlign: 'center' },
  qrInput: {
    width: '100%', maxWidth: '440px', backgroundColor: '#1a1a1a', border: '2px solid #9c6eff',
    borderRadius: '10px', padding: '1rem', color: '#f0f0f0', fontSize: '0.9rem',
    outline: 'none', textAlign: 'center', boxSizing: 'border-box', fontFamily: 'monospace',
  },
  scanBtn: { backgroundColor: '#9c6eff', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.7rem 2rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' },
  resultCard: { width: '100%', maxWidth: '360px', backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '2rem', textAlign: 'center', border: '2px solid #4caf50', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  resultIcon: { width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#1a3a1a', color: '#4caf50', fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  guestName: { fontSize: '1.5rem', fontWeight: 700 },
  guestMeta: { display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#aaa', fontSize: '0.9rem' },
  tierTag: { backgroundColor: '#2a2a2a', borderRadius: '5px', padding: '0.2rem 0.5rem', color: '#d4af37', fontWeight: 600, fontSize: '0.85rem' },
  alreadyIn: { color: '#ff9f4a', margin: 0, fontSize: '0.9rem' },
  checkinTime: { color: '#888', margin: 0, fontSize: '0.85rem' },
  nextBtn: { marginTop: '0.5rem', backgroundColor: '#2a2a2a', color: '#f0f0f0', border: 'none', borderRadius: '8px', padding: '0.65rem 2rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', width: '100%' },
  errorCard: { width: '100%', maxWidth: '360px', backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '2rem', textAlign: 'center', border: '2px solid #e55', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  errorIcon: { width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#2a1a1a', color: '#e55', fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  errorMsg: { color: '#e55', margin: 0, fontSize: '0.95rem' },
};
