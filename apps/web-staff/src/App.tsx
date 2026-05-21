import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DoorPage from './pages/DoorPage';
import KeyholderDashboard from './pages/KeyholderDashboard';
import WaiterPage from './pages/WaiterPage';

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'keyholder') return <KeyholderDashboard />;
  if (user?.role === 'waiter') return <WaiterPage />;
  return <DoorPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
