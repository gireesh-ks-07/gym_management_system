import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ROUTE_ROLES, homePathForRole, isFacilityBlocked, moduleAvailable } from './config/roles';

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
const Gamification = lazy(() => import('./pages/gamification/Gamification'));
const Nutrition = lazy(() => import('./pages/nutrition/Nutrition'));
const PersonalTraining = lazy(() => import('./pages/pt/PersonalTraining'));

const Loader = () => (
  <div className="loader-container">
    <div className="loader-icon"></div>
    <div className="loading-text">PREPARING YOUR DASHBOARD...</div>
  </div>
);


const ProtectedRoute = ({ children, roles, routeKey }) => {
  const { user, loading, facilitySubscription } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) {
    const home = homePathForRole(user.role);
    return <Navigate to={location.pathname === home ? '/login' : home} />;
  }

  // A module the facility's plan doesn't include is not reachable by URL either.
  if (routeKey && !moduleAvailable(routeKey, facilitySubscription?.enabledModules)) {
    return <Navigate to={homePathForRole(user.role)} />;
  }

  // A lapsed subscription locks every facility role — dieticians included —
  // out of everything but their landing page.
  if (isFacilityBlocked(user.role, facilitySubscription)) {
    const home = homePathForRole(user.role);
    if (location.pathname !== home) return <Navigate to={home} />;
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
                  <ProtectedRoute roles={ROUTE_ROLES.dashboard}>
                    {/* Dashboard for everyone, content adapts inside */}
                    <Dashboard />
                  </ProtectedRoute>
                } />

                <Route path="/clients" element={
                  <ProtectedRoute roles={ROUTE_ROLES.members}>
                    <Clients />
                  </ProtectedRoute>
                } />
                <Route path="/clients/:id/health" element={
                  <ProtectedRoute roles={ROUTE_ROLES.healthProfile}>
                    <HealthProfile />
                  </ProtectedRoute>
                } />

                <Route path="/facilities" element={
                  <ProtectedRoute roles={ROUTE_ROLES.facilities}>
                    <Facilities />
                  </ProtectedRoute>
                } />

                <Route path="/subscription-plans" element={
                  <ProtectedRoute roles={ROUTE_ROLES.subscriptionPlans}>
                    <SubscriptionPlans />
                  </ProtectedRoute>
                } />

                <Route path="/facility-types" element={
                  <ProtectedRoute roles={ROUTE_ROLES.facilityTypes}>
                    <FacilityTypes />
                  </ProtectedRoute>
                } />

                <Route path="/plans" element={
                  <ProtectedRoute roles={ROUTE_ROLES.plans}>
                    <Plans />
                  </ProtectedRoute>
                } />

                <Route path="/staff" element={
                  <ProtectedRoute roles={ROUTE_ROLES.staff}>
                    <Staff />
                  </ProtectedRoute>
                } />

                <Route path="/payments" element={
                  <ProtectedRoute roles={ROUTE_ROLES.payments}>
                    <Payments />
                  </ProtectedRoute>
                } />

                <Route path="/reports" element={
                  <ProtectedRoute roles={ROUTE_ROLES.reports}>
                    <Reports />
                  </ProtectedRoute>
                } />

                <Route path="/gamification" element={
                  <ProtectedRoute roles={ROUTE_ROLES.gamification} routeKey="gamification">
                    <Gamification />
                  </ProtectedRoute>
                } />

                <Route path="/nutrition" element={
                  <ProtectedRoute roles={ROUTE_ROLES.nutrition} routeKey="nutrition">
                    <Nutrition />
                  </ProtectedRoute>
                } />

                <Route path="/personal-training" element={
                  <ProtectedRoute roles={ROUTE_ROLES.personalTraining} routeKey="personalTraining">
                    <PersonalTraining />
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
