import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Dumbbell, LogOut, Settings, Tag, CreditCard, BarChart2 } from 'lucide-react';

const Sidebar = () => {
    const { user, logout } = useAuth();

    // Default to empty object if user is null to avoid crash
    const role = user?.role;

    return (
        <div className="sidebar">
            <div className="sidebar-brand">
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))',
                    padding: '8px',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px var(--primary-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Dumbbell size={24} color="white" />
                </div>
                <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>FitManager</span>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </NavLink>

                {role === 'superadmin' && (
                    <NavLink to="/gyms" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Dumbbell size={20} />
                        <span>Gyms</span>
                    </NavLink>
                )}

                {['admin', 'trainer'].includes(role) && (
                    <NavLink to="/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Members</span>
                    </NavLink>
                )}

                {role === 'admin' && (
                    <NavLink to="/plans" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>Plans</span>
                    </NavLink>
                )}

                {role === 'admin' && (
                    <NavLink to="/staff" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        <span>Staff</span>
                    </NavLink>
                )}

                {['admin', 'trainer'].includes(role) && (
                    <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Payments</span>
                    </NavLink>
                )}

                {['admin', 'superadmin'].includes(role) && (
                    <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <BarChart2 size={20} />
                        <span>Reports</span>
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
