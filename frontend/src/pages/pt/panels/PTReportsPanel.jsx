import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ptApi } from '../../../api/pt';
import { Users, CheckCircle, CalendarClock, XCircle, UserX } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.7rem', borderRadius: 14, background: `${color}1a`, color, display: 'flex' }}><Icon size={22} /></div>
        <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
    </div>
);

const PTReportsPanel = () => {
    const { facilitySubscription } = useAuth();
    const facilityId = facilitySubscription?.id;
    const { addToast } = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setData(await ptApi.getReports({ facilityId }));
            } catch (e) { addToast('Failed to load PT reports', 'error'); }
            finally { setLoading(false); }
        })();
    }, [facilityId]);

    if (loading || !data) return <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>;

    const t = data.totals;
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <StatCard icon={Users} label="Active PT Members" value={t.activePTMembers} color="#6366F1" />
                <StatCard icon={CheckCircle} label="Completed Sessions" value={t.completed} color="#22C55E" />
                <StatCard icon={CalendarClock} label="Scheduled" value={t.scheduled} color="#3B82F6" />
                <StatCard icon={XCircle} label="Cancelled" value={t.cancelled} color="#F59E0B" />
                <StatCard icon={UserX} label="No-shows" value={t.no_show} color="#EF4444" />
            </div>

            <div className="card">
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>Trainer-wise Sessions</div>
                <div className="table-responsive" style={{ padding: '0.5rem' }}>
                    <table className="modern-table">
                        <thead><tr><th>Trainer</th><th>Total Sessions</th><th>Completed</th><th style={{ minWidth: 160 }}>Completion Rate</th></tr></thead>
                        <tbody>
                            {data.byTrainer.map((row) => {
                                const rate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                                return (
                                    <tr key={row.trainerId ?? 'unassigned'}>
                                        <td style={{ fontWeight: 600 }}>{row.trainerName}</td>
                                        <td>{row.total}</td>
                                        <td>{row.completed}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: `${rate}%`, height: '100%', background: 'var(--primary)' }} />
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{rate}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.byTrainer.length === 0 && <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No session data yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PTReportsPanel;
