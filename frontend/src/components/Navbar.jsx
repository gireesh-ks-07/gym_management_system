import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Plus, User, Dumbbell, UserCog, Tag, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowQuickAdd(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleQuickAction = (path) => {
        navigate(path);
        setShowQuickAdd(false);
    };

    return (
        <div className="top-navbar">
            <div className="search-bar">
                <Search size={18} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search members, plans..."
                    className="search-input"
                />
            </div>

            <div className="action-icons">
                <div style={{ position: 'relative' }} ref={menuRef}>
                    <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                    >
                        <Plus size={16} />
                        <span>Quick Add</span>
                    </button>

                    {showQuickAdd && (
                        <div className="action-menu-popup animate-fade-in" style={{
                            position: 'absolute',
                            top: '120%',
                            right: 0,
                            width: '220px',
                            zIndex: 100,
                            padding: '0.5rem'
                        }}>
                            <button className="action-menu-item" onClick={() => handleQuickAction('/clients?action=add')}>
                                <User size={16} />
                                <span>Add Member</span>
                            </button>

                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                <>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/staff?action=add')}>
                                        <UserCog size={16} />
                                        <span>Add Staff</span>
                                    </button>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/plans?action=add')}>
                                        <Tag size={16} />
                                        <span>Create Plan</span>
                                    </button>
                                </>
                            )}

                            {(user?.role === 'admin' || user?.role === 'trainer' || user?.role === 'superadmin') && (
                                <button className="action-menu-item" onClick={() => handleQuickAction('/payments?action=add')}>
                                    <CreditCard size={16} />
                                    <span>Record Payment</span>
                                </button>
                            )}

                            {user?.role === 'superadmin' && (
                                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/gyms?action=add')}>
                                        <Dumbbell size={16} />
                                        <span>Register Gym</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button className="icon-btn">
                    <Bell size={20} />
                    <span className="notification-dot"></span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
                    <div style={{ textAlign: 'right', display: 'none', '@media (min-width: 768px)': { display: 'block' } }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>{user?.name || 'User'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role || 'Admin'}</div>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navbar;
