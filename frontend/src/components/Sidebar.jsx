import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { can, isFacilityBlocked, moduleAvailable } from '../config/roles';
import { LayoutDashboard, Users, LogOut, Settings, Tag, CreditCard, BarChart2, Building2, Layers, Trophy, X, Apple, Dumbbell } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout, facilitySubscription } = useAuth();
    const role = user?.role;
    const isRestrictedFacilityUser = isFacilityBlocked(role, facilitySubscription);
    // A nav item shows when the role may open the route, the facility's plan
    // includes the module behind it, and the subscription is live.
    const show = (routeKey) =>
        can(routeKey, role)
        && moduleAvailable(routeKey, facilitySubscription?.enabledModules)
        && !isRestrictedFacilityUser;

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-brand">
                <img
                    src="/logo_with_image.svg"
                    alt="MobileMonks"
                    style={{ width: '150px', maxWidth: '100%', height: 'auto', display: 'block' }}
                />

                <button
                    onClick={onClose}
                    className="sidebar-close-btn"
                    style={{ marginLeft: 'auto' }}
                >
                    <X size={20} />
                </button>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {show('dashboard') && (
                    <NavLink to="/" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                )}

                {show('facilities') && (
                    <NavLink to="/facilities" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Building2 size={20} />
                        <span>Facilities</span>
                    </NavLink>
                )}

                {show('subscriptionPlans') && (
                    <NavLink to="/subscription-plans" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>SaaS Plans</span>
                    </NavLink>
                )}

                {show('facilityTypes') && (
                    <NavLink to="/facility-types" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Layers size={20} />
                        <span>Facility Types</span>
                    </NavLink>
                )}

                {show('members') && (
                    <NavLink to="/clients" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Members</span>
                    </NavLink>
                )}

                {show('plans') && (
                    <NavLink to="/plans" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>Plans</span>
                    </NavLink>
                )}

                {show('staff') && (
                    <NavLink to="/staff" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        <span>Staff</span>
                    </NavLink>
                )}

                {show('payments') && (
                    <NavLink to="/payments" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Payments</span>
                    </NavLink>
                )}

                {show('reports') && (
                    <NavLink to="/reports" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <BarChart2 size={20} />
                        <span>Reports</span>
                    </NavLink>
                )}

                {show('gamification') && (
                    <NavLink to="/gamification" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Trophy size={20} />
                        <span>Gamification</span>
                    </NavLink>
                )}

                {show('nutrition') && (
                    <NavLink to="/nutrition" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Apple size={20} />
                        <span>{role === 'dietician' ? 'Diet Charts' : 'Nutrition'}</span>
                    </NavLink>
                )}

                {show('personalTraining') && (
                    <NavLink to="/personal-training" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Dumbbell size={20} />
                        <span>Personal Training</span>
                    </NavLink>
                )}
            </nav>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                <button onClick={logout} className="nav-item" style={{ background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', color: '#f87171' }}>
                    <LogOut size={20} />
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
