import React, { useEffect, useState } from 'react';
import api from '../api';
import { User, DollarSign, Wallet, RefreshCw, CreditCard, PieChart } from 'lucide-react';
import { formatDate } from '../utils/date';

const Reports = () => {
    const [stats, setStats] = useState({
        revenue: { total: 0, cash: 0, upi: 0 },
        planStats: [],
        recentPayments: [],
        genderStats: null
    });

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/reports');
            setStats(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon, color }) => (
        <div className="card stat-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
                width: '60px', height: '60px', borderRadius: '16px',
                background: color + '20', color: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${color}30`
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-highlight)' }}>{value}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title}</div>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Business Reports</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Overview of financial performance and memberships</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchStats}>
                    <RefreshCw size={18} />
                    <span>Refresh Data</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <StatCard title="Total Revenue" value={`₹${stats.revenue.total}`} icon={<DollarSign size={28} />} color="#10b981" />
                <StatCard title="Cash Revenue" value={`₹${stats.revenue.cash}`} icon={<Wallet size={28} />} color="#f59e0b" />
                <StatCard title="UPI Revenue" value={`₹${stats.revenue.upi}`} icon={<CreditCard size={28} />} color="#6366f1" />
            </div>

            {stats.genderStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <StatCard title="Male Members" value={stats.genderStats.male} icon={<User size={22} />} color="#3b82f6" />
                    <StatCard title="Female Members" value={stats.genderStats.female} icon={<User size={22} />} color="#ec4899" />
                    <StatCard title="Other Members" value={stats.genderStats.other} icon={<User size={22} />} color="#8b5cf6" />
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                {/* Plan Distribution */}
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: '#3b82f6' }}>
                            <PieChart size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Membership Plan Distribution</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {stats.planStats.length > 0 ? stats.planStats.map((plan, idx) => (
                            <div key={idx}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{plan.name}</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{plan.count} Members</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(plan.count / (stats.planStats.reduce((a, b) => a + b.count, 0) || 1)) * 100}%`,
                                        height: '100%',
                                        background: 'var(--primary)',
                                        borderRadius: '4px'
                                    }}></div>
                                </div>
                            </div>
                        )) : (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No plans found.</p>
                        )}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: '#10b981' }}>
                            <RefreshCw size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Recent Transactions</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {stats.recentPayments.length > 0 ? stats.recentPayments.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{p.Client?.name || 'Unknown Client'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(p.date)} • {p.method.toUpperCase()}</div>
                                </div>
                                <div style={{ fontWeight: '700', color: 'var(--primary)' }}>+₹{p.amount}</div>
                            </div>
                        )) : (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No transactions found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
