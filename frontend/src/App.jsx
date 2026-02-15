import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Gyms from './pages/Gyms';
import Clients from './pages/Clients';
import Staff from './pages/Staff';
import Payments from './pages/Payments';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Plans from './pages/Plans';
import SubscriptionPlans from './pages/SubscriptionPlans';

const Loader = () => (
  <div className="loader-container">
    <div className="dumbbell"></div>
    <div className="loading-text">LIFTING WEIGHTS...</div>
  </div>
);

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return (
    <div className="dashboard-layout">
      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="main-content">
        <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div style={{ padding: '0 0.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute roles={['admin', 'trainer', 'superadmin']}>
                {/* Dashboard for everyone, content adapts inside */}
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/clients" element={
              <ProtectedRoute roles={['admin', 'trainer', 'superadmin']}>
                <Clients />
              </ProtectedRoute>
            } />

            <Route path="/gyms" element={
              <ProtectedRoute roles={['superadmin']}>
                <Gyms />
              </ProtectedRoute>
            } />

            <Route path="/subscription-plans" element={
              <ProtectedRoute roles={['superadmin']}>
                <SubscriptionPlans />
              </ProtectedRoute>
            } />

            <Route path="/plans" element={
              <ProtectedRoute roles={['admin']}>
                <Plans />
              </ProtectedRoute>
            } />

            <Route path="/staff" element={
              <ProtectedRoute roles={['admin']}>
                <Staff />
              </ProtectedRoute>
            } />

            <Route path="/payments" element={
              <ProtectedRoute roles={['admin', 'trainer']}>
                <Payments />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute roles={['admin', 'superadmin']}>
                <Reports />
              </ProtectedRoute>
            } />

          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
