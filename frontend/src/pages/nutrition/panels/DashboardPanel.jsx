import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { dieticianApi } from '../../../api/dietician';
import { nutritionApi } from '../../../api/nutrition';
import { Stethoscope, Users, CheckCircle2, Clock, FileText, Apple } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_COLORS = { draft: '#F59E0B', active: '#22C55E', archived: '#64748B' };

const KpiCard = ({ icon, label, value, color }) => (
    <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</p>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-highlight)' }}>{value}</h2>
            </div>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(icon, { size: 22 })}
            </div>
        </div>
    </div>
);

const DashboardPanel = () => {
    const { facilitySubscription } = useAuth();
    const facilityId = facilitySubscription?.id;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [dieticians, clients, charts, foods] = await Promise.all([
                    dieticianApi.getDieticians(facilityId),
                    dieticianApi.getClients(facilityId),
                    dieticianApi.getCharts(facilityId),
                    nutritionApi.getFoods(facilityId).catch(() => [])
                ]);
                setData({ dieticians, clients, charts, foods });
            } catch {
                setData(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [facilityId]);

    if (loading) return <div className="card"><div className="loader-container" style={{ minHeight: 160 }}><div className="loader-icon" /></div></div>;
    if (!data) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Unable to load nutrition overview.</div>;

    const { dieticians, clients, charts, foods } = data;
    const activeClientIds = new Set(charts.filter((c) => c.status === 'active').map((c) => c.clientId));
    const assigned = clients.filter((c) => c.dieticianId);
    const completed = assigned.filter((c) => activeClientIds.has(c.id));
    const pending = assigned.length - completed.length;

    const statusCounts = charts.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
    const statusData = ['active', 'draft', 'archived']
        .filter((s) => statusCounts[s])
        .map((s) => ({ name: s[0].toUpperCase() + s.slice(1), value: statusCounts[s], color: STATUS_COLORS[s] }));

    // Per-dietician workload
    const chartsByDietician = charts.reduce((acc, c) => { if (c.dieticianId) (acc[c.dieticianId] ||= []).push(c); return acc; }, {});
    const workload = dieticians.map((d) => {
        const dClients = clients.filter((c) => c.dieticianId === d.id);
        const dCompleted = dClients.filter((c) => activeClientIds.has(c.id)).length;
        return { id: d.id, name: d.name, clients: dClients.length, completed: dCompleted, charts: (chartsByDietician[d.id] || []).length };
    }).sort((a, b) => b.clients - a.clients);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <KpiCard icon={<Stethoscope />} label="Dieticians" value={dieticians.length} color="#3B82F6" />
                <KpiCard icon={<Users />} label="Assigned Members" value={assigned.length} color="#22C55E" />
                <KpiCard icon={<CheckCircle2 />} label="Completed Plans" value={completed.length} color="#06B6D4" />
                <KpiCard icon={<Clock />} label="Pending" value={pending} color="#F59E0B" />
                <KpiCard icon={<FileText />} label="Diet Charts" value={charts.length} color="#8B5CF6" />
                <KpiCard icon={<Apple />} label="Foods in Database" value={foods.length} color="#EF4444" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Charts by status */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Diet Charts by Status</h3>
                    {statusData.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No diet charts yet.</div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ width: 160, height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                                            {statusData.map((e) => <Cell key={e.name} fill={e.color} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {statusData.map((e) => (
                                    <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                                        <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{e.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Dietician workload */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Dietician Workload</h3>
                    {workload.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No dieticians yet. Add one from the Staff section.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            {workload.map((w) => {
                                const pct = w.clients > 0 ? Math.round((w.completed / w.clients) * 100) : 0;
                                return (
                                    <div key={w.id}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.88rem' }}>
                                            <span style={{ fontWeight: 600 }}>{w.name}</span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{w.completed}/{w.clients} completed · {w.charts} chart{w.charts === 1 ? '' : 's'}</span>
                                        </div>
                                        <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #34D399)' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPanel;
