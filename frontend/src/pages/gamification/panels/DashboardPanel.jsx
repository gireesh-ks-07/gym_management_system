import React, { useEffect, useState } from 'react';
import api from '../../../api';
import { Users, Zap, Flame, Target, Activity, TrendingUp } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';

const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString('en-IN'));

const KpiCard = ({ title, value, icon, color }) => (
    <div className="card stat-card" style={{ padding: '1.5rem', minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{
            padding: '0.6rem', borderRadius: '14px', background: `${color}15`, color,
            width: 'fit-content'
        }}>
            {React.cloneElement(icon, { size: 22, strokeWidth: 2.5 })}
        </div>
        <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-highlight)' }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{title}</div>
        </div>
    </div>
);

const DashboardPanel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/gamification/dashboard')
            .then((res) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Loading analytics…</div>;
    if (!data) return <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Unable to load analytics.</div>;

    const kpis = [
        { title: 'Total Members', value: fmt(data.totalMembers), icon: <Users />, color: '#3B82F6' },
        { title: 'Total XP Earned', value: fmt(data.totalXp), icon: <Zap />, color: '#F59E0B' },
        { title: 'Active Streaks', value: fmt(data.activeStreaks), icon: <Flame />, color: '#EF4444' },
        { title: 'Challenges Done', value: fmt(data.challengesCompleted), icon: <Target />, color: '#8B5CF6' },
        { title: 'Daily Active Users', value: fmt(data.dailyActiveUsers), icon: <Activity />, color: '#10B981' },
        { title: 'XP Earned Today', value: fmt(data.xpToday), icon: <TrendingUp />, color: '#06B6D4' }
    ];

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {kpis.map((k) => <KpiCard key={k.title} {...k} />)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* XP trend */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>XP Earned · Last 14 Days</h3>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.xpTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d?.slice(5)} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12 }} />
                                <Area type="monotone" dataKey="xp" stroke="var(--primary)" strokeWidth={2.5} fill="url(#xpGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* League distribution */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>League Distribution</h3>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.leagueDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-30} textAnchor="end" height={50} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12 }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {data.leagueDistribution.map((l) => <Cell key={l.tier} fill={l.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top performers */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Top Performers · This Week</h3>
                {data.topPerformers?.length ? (
                    <table className="modern-table">
                        <thead><tr><th>Rank</th><th>Member</th><th>Level</th><th>Weekly XP</th></tr></thead>
                        <tbody>
                            {data.topPerformers.map((p) => (
                                <tr key={p.clientId}>
                                    <td style={{ fontWeight: 700 }}>#{p.rank}</td>
                                    <td>{p.name}</td>
                                    <td>Lv {p.level}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(p.xp)} XP</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <div style={{ color: 'var(--text-muted)' }}>No activity yet this week.</div>}
            </div>
        </div>
    );
};

export default DashboardPanel;
