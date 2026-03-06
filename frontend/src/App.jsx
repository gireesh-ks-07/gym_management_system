import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';

// Eager-load Login (entry point, must be instant)
import Login from './pages/Login';

// Lazy-load all other pages for code splitting (reduces initial bundle)
const Facilities = lazy(() => import('./pages/Facilities'));
const Clients = lazy(() => import('./pages/Clients'));
const Staff = lazy(() => import('./pages/Staff'));
const Payments = lazy(() => import('./pages/Payments'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reports = lazy(() => import('./pages/Reports'));
const Plans = lazy(() => import('./pages/Plans'));
const SubscriptionPlans = lazy(() => import('./pages/SubscriptionPlans'));
const FacilityTypes = lazy(() => import('./pages/FacilityTypes'));
const HealthProfile = lazy(() => import('./pages/HealthProfile'));

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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<Loader />}>
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
                <Route path="/clients/:id/health" element={
                  <ProtectedRoute roles={['admin', 'staff']}>
                    <HealthProfile />
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
            </Suspense>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
