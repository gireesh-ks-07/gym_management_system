import React, { useEffect, useState } from 'react';
import api from '../api';
import { Users, AlertTriangle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState({ totalGyms: 0, activeGyms: 0, suspendedGyms: 0, expiredGyms: 0, mrr: 0 });
    const [expiringGyms, setExpiringGyms] = useState([]);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/superadmin/dashboard');
                setStats(res.data.stats);
                setExpiringGyms(res.data.expiringGyms);
            } catch (err) {
                console.error(err);
                addToast('Failed to fetch dashboard data', 'error');
            }
        };
        fetchDashboard();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="card stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 className="stat-title">{title}</h3>
                    <div className="stat-value">{value}</div>
                </div>
                <div className="stat-icon" style={{ background: `${color}20`, color: color }}>
                    <Icon size={24} />
                </div>
            </div>
            {subtext && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{subtext}</div>}
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Super Admin Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Platform Overview & Health</p>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <StatCard
                    title="Total Gyms"
                    value={stats.totalGyms}
                    icon={Users}
                    color="var(--primary)"
                />
                <StatCard
                    title="Active Gyms"
                    value={stats.activeGyms}
                    icon={CheckCircle}
                    color="var(--success)"
                />
                <StatCard
                    title="Suspended/Expired"
                    value={stats.suspendedGyms + stats.expiredGyms}
                    icon={XCircle}
                    color="var(--danger)"
                    subtext={`${stats.expiredGyms} Expired`}
                />
                <StatCard
                    title="Recurring Revenue"
                    value={`₹${stats.mrr.toLocaleString()}`}
                    icon={TrendingUp}
                    color="var(--accent-purple)"
                    subtext="Monthly Recurring Revenue"
                />
            </div>

            {/* Expiring Subscriptions */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertTriangle size={20} color="var(--accent-orange)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Expiring Subscriptions (Next 7 Days)</h3>
                </div>

                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Gym Name</th>
                                <th>Plan</th>
                                <th>Expiry Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringGyms.map((gym, index) => (
                                <tr key={gym.id}>
                                    <td style={{ paddingLeft: '2rem', fontWeight: '500' }}>{gym.name}</td>
                                    <td>{gym.SubscriptionPlan ? gym.SubscriptionPlan.name : 'N/A'}</td>
                                    <td style={{ color: 'var(--danger)' }}>{new Date(gym.subscriptionExpiresAt).toLocaleDateString()}</td>
                                    <td>
                                        <span className="status-badge" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)' }}>
                                            Expiring Soon
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {expiringGyms.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        No critical expiries found for the upcoming week.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
