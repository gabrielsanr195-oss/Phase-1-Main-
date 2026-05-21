import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DoorPage from './pages/DoorPage';
import KeyholderDashboard from './pages/KeyholderDashboard';
import WaiterPage from './pages/WaiterPage';
import WarehousePage from './pages/WarehousePage';
import BarPage from './pages/BarPage';

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'keyholder') return <KeyholderDashboard />;
  if (user?.role === 'waiter') return <WaiterPage />;
  if (user?.role === 'warehouse') return <WarehousePage />;
  if (user?.role === 'bartender') return <BarPage />;
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
