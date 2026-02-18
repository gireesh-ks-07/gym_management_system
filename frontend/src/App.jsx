import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Facilities from './pages/Facilities';
import Clients from './pages/Clients';
import Staff from './pages/Staff';
import Payments from './pages/Payments';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Plans from './pages/Plans';
import SubscriptionPlans from './pages/SubscriptionPlans';
import FacilityTypes from './pages/FacilityTypes';

const Loader = () => (
  <div className="loader-container">
    <div className="loader-icon"></div>
    <div className="loading-text">PREPARING YOUR DASHBOARD...</div>
  </div>
);

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, facilitySubscription } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  const isRestrictedFacilityUser =
    ['admin', 'staff'].includes(user.role) &&
    facilitySubscription &&
    facilitySubscription.subscriptionStatus !== 'active';

  if (isRestrictedFacilityUser && location.pathname !== '/') {
    return <Navigate to="/" />;
  }

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
        <div>
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
              <ProtectedRoute roles={['admin', 'staff', 'superadmin']}>
                {/* Dashboard for everyone, content adapts inside */}
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/clients" element={
              <ProtectedRoute roles={['admin', 'staff', 'superadmin']}>
                <Clients />
              </ProtectedRoute>
            } />

            <Route path="/facilities" element={
              <ProtectedRoute roles={['superadmin']}>
                <Facilities />
              </ProtectedRoute>
            } />

            <Route path="/subscription-plans" element={
              <ProtectedRoute roles={['superadmin']}>
                <SubscriptionPlans />
              </ProtectedRoute>
            } />

            <Route path="/facility-types" element={
              <ProtectedRoute roles={['superadmin']}>
                <FacilityTypes />
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
              <ProtectedRoute roles={['admin', 'staff']}>
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
