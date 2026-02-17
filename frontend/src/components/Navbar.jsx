import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Plus, User, Building2, UserCog, Tag, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Navbar = ({ toggleSidebar }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const menuRef = useRef(null);
    const notificationRef = useRef(null);
    const [notifications, setNotifications] = useState([]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        if (user) fetchNotifications();
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowQuickAdd(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleQuickAction = (path) => {
        navigate(path);
        setShowQuickAdd(false);
    };

    const hasUnread = notifications.some(n => !n.isRead);

    const handleNotificationClick = async (id, path) => {
        try {
            await api.post(`/api/notifications/mark-read/${id}`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error(err);
        }
        setShowNotifications(false);
        if (path) navigate(path);
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/api/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="top-navbar">
            <button
                className="btn btn-ghost sidebar-toggle-btn"
                onClick={toggleSidebar}
                style={{ marginRight: '1rem' }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '24px' }}>
                    <span style={{ height: '2px', width: '100%', background: 'var(--text-main)', borderRadius: '2px' }}></span>
                    <span style={{ height: '2px', width: '100%', background: 'var(--text-main)', borderRadius: '2px' }}></span>
                    <span style={{ height: '2px', width: '100%', background: 'var(--text-main)', borderRadius: '2px' }}></span>
                </div>
            </button>

            <div className="search-bar">
                <Search size={18} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder={user?.role === 'superadmin' ? "Search facilities, SaaS plans..." : "Search members, plans..."}
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
                            {user?.role !== 'superadmin' && (
                                <>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/clients?action=add')}>
                                        <User size={16} />
                                        <span>Add Member</span>
                                    </button>

                                    {(user?.role === 'admin') && (
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

                                    {(user?.role === 'admin' || user?.role === 'staff') && (
                                        <button className="action-menu-item" onClick={() => handleQuickAction('/payments?action=add')}>
                                            <CreditCard size={16} />
                                            <span>Record Payment</span>
                                        </button>
                                    )}
                                </>
                            )}

                            {user?.role === 'superadmin' && (
                                <>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/facilities?action=add')}>
                                        <Building2 size={16} />
                                        <span>Register Facility</span>
                                    </button>
                                    <button className="action-menu-item" onClick={() => handleQuickAction('/subscription-plans?action=add')}>
                                        <Tag size={16} />
                                        <span>Create SaaS Plan</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ position: 'relative' }} ref={notificationRef}>
                    <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
                        <Bell size={20} />
                        {hasUnread && <span className="notification-dot"></span>}
                    </button>

                    {showNotifications && (
                        <div className="action-menu-popup animate-fade-in" style={{
                            position: 'absolute',
                            top: '120%',
                            right: 0,
                            width: '300px',
                            zIndex: 100,
                            padding: '0'
                        }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>Notifications</div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n.id, n.path)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            background: !n.isRead ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px'
                                        }} className="notification-item"
                                    >
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: !n.isRead ? '600' : '400' }}>{n.message}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                ))}
                            </div>
                            <div
                                onClick={markAllAsRead}
                                style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)', cursor: 'pointer' }}
                            >
                                Mark all as read
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
                    <div className="user-text-container" style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>{user?.name || 'User'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role || 'Admin'}</div>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
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
