import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Activity, LogOut, Settings, Tag, CreditCard, BarChart2, Building2, Layers, X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const role = user?.role;

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <Activity size={20} color="white" />
                </div>
                <div>
                    <div className="brand-name">OpsMonks</div>
                    <div className="brand-caption">AI POWERED SOLUTIONS</div>
                </div>

                <button
                    onClick={onClose}
                    className="sidebar-close-btn"
                >
                    <X size={20} />
                </button>
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                <NavLink to="/" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </NavLink>

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

                {['admin', 'staff'].includes(role) && (
                    <NavLink to="/clients" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Members</span>
                    </NavLink>
                )}

                {role === 'admin' && (
                    <NavLink to="/plans" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Tag size={20} />
                        <span>Plans</span>
                    </NavLink>
                )}

                {role === 'admin' && (
                    <NavLink to="/staff" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        <span>Staff</span>
                    </NavLink>
                )}

                {['admin', 'staff'].includes(role) && (
                    <NavLink to="/payments" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <CreditCard size={20} />
                        <span>Payments</span>
                    </NavLink>
                )}

                {['admin', 'superadmin'].includes(role) && (
                    <NavLink to="/reports" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
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
