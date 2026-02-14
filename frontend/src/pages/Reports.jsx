import React, { useEffect, useState } from 'react';
import api from '../api';
import { User, DollarSign, Wallet, RefreshCw, CreditCard, PieChart } from 'lucide-react';

const Reports = () => {
    const [stats, setStats] = useState({
        genderStats: { male: 0, female: 0, other: 0 },
        revenue: { total: 0, cash: 0, upi: 0 }
    });

    const fetchStats = async () => {
        try {
            const res = await api.get('/reports');
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
                    <p style={{ color: 'var(--text-secondary)' }}>Overview of client demographics and revenue</p>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: '#3b82f6' }}>
                            <PieChart size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Client Demographics</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Male</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.genderStats.male}</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${stats.genderStats.male / (stats.genderStats.male + stats.genderStats.female + stats.genderStats.other || 1) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                    borderRadius: '6px'
                                }}></div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Female</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.genderStats.female}</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${stats.genderStats.female / (stats.genderStats.male + stats.genderStats.female + stats.genderStats.other || 1) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #ec4899, #f472b6)',
                                    borderRadius: '6px'
                                }}></div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Other</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.genderStats.other}</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${stats.genderStats.other / (stats.genderStats.male + stats.genderStats.female + stats.genderStats.other || 1) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                                    borderRadius: '6px'
                                }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
