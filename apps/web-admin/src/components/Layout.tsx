import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>Phase 1+</div>
        <nav style={s.nav}>
          <NavLink to="/" end style={navStyle}>
            Eventos
          </NavLink>
          <NavLink to="/keyholders" style={navStyle}>
            Keyholders
          </NavLink>
        </nav>
        <div style={s.userArea}>
          <p style={s.userName}>{user?.firstName} {user?.lastName}</p>
          <p style={s.userRole}>{user?.role}</p>
          <button style={s.logoutBtn} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  );
}

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'block',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    color: isActive ? '#fff' : '#aaa',
    backgroundColor: isActive ? '#2a2a2a' : 'transparent',
    textDecoration: 'none',
    fontSize: '0.95rem',
    marginBottom: '0.25rem',
  };
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#f0f0f0' },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    backgroundColor: '#141414',
    borderRight: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.25rem 1rem',
  },
  brand: { fontSize: '1.1rem', fontWeight: 700, color: '#d4af37', marginBottom: '2rem', paddingLeft: '0.25rem' },
  nav: { flex: 1 },
  userArea: { borderTop: '1px solid #222', paddingTop: '1rem' },
  userName: { margin: '0 0 0.1rem', fontSize: '0.85rem', fontWeight: 600 },
  userRole: { margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#aaa',
    borderRadius: '5px',
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    width: '100%',
  },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
};
