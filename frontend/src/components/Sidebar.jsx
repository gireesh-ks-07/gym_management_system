import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, LogOut, Settings, Tag, CreditCard, BarChart2, Building2, Layers, Trophy, X, Apple, Dumbbell } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout, facilitySubscription } = useAuth();
    const role = user?.role;
    const isRestrictedFacilityUser =
        ['admin', 'staff'].includes(role) &&
        facilitySubscription &&
        facilitySubscription.subscriptionStatus !== 'active';

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
                {role !== 'dietician' && (
                    <NavLink to="/" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                )}

                {role === 'superadmin' && (
                    <NavLink to="/facilities" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Building2 size={20} />
                        <span>Facilities</span>
                    </NavLink>
                )}

                {role === 'superadmin' && (
                    <NavLink to="/subscription-plans" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>SaaS Plans</span>
                    </NavLink>
                )}

                {role === 'superadmin' && (
                    <NavLink to="/facility-types" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Layers size={20} />
                        <span>Facility Types</span>
                    </NavLink>
                )}

                {['admin', 'staff'].includes(role) && !isRestrictedFacilityUser && (
                    <NavLink to="/clients" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Members</span>
                    </NavLink>
                )}

                {role === 'admin' && !isRestrictedFacilityUser && (
                    <NavLink to="/plans" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>Plans</span>
                    </NavLink>
                )}

                {role === 'admin' && !isRestrictedFacilityUser && (
                    <NavLink to="/staff" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        <span>Staff</span>
                    </NavLink>
                )}

                {['admin', 'staff'].includes(role) && !isRestrictedFacilityUser && (
                    <NavLink to="/payments" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Payments</span>
                    </NavLink>
                )}

                {['admin', 'superadmin'].includes(role) && !isRestrictedFacilityUser && (
                    <NavLink to="/reports" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <BarChart2 size={20} />
                        <span>Reports</span>
                    </NavLink>
                )}

                {['admin', 'superadmin'].includes(role) && !isRestrictedFacilityUser && (
                    <NavLink to="/gamification" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Trophy size={20} />
                        <span>Gamification</span>
                    </NavLink>
                )}

                {['admin', 'staff', 'dietician'].includes(role) && !isRestrictedFacilityUser && (
                    <NavLink to="/nutrition" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Apple size={20} />
                        <span>{role === 'dietician' ? 'Diet Charts' : 'Nutrition'}</span>
                    </NavLink>
                )}

                {['admin', 'staff'].includes(role) && !isRestrictedFacilityUser && (
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
