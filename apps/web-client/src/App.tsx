import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import ConfirmationPage from './pages/ConfirmationPage';
import StatusPage from './pages/StatusPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/r/:token" element={<RegisterPage />} />
        <Route path="/r/:token/done" element={<ConfirmationPage />} />
        <Route path="/r/:token/status" element={<StatusPage />} />
        <Route
          path="*"
          element={
            <div style={{ fontFamily: 'sans-serif', padding: '2rem', color: '#f0f0f0', background: '#0f0f0f', minHeight: '100vh' }}>
              <h1>Phase 1+ — Guest App</h1>
              <p>Accede mediante un enlace de invitación.</p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
