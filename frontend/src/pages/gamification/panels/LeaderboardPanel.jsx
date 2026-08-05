import React, { useEffect, useState } from 'react';
import api from '../../../api';
import { useToast } from '../../../context/ToastContext';
import { Download, RefreshCw, Trophy } from 'lucide-react';
import MemberProfileModal from './MemberProfileModal';

const PERIODS = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'all', label: 'All-Time' }
];

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

const LeaderboardPanel = () => {
    const { addToast } = useToast();
    const [period, setPeriod] = useState('weekly');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const load = () => {
        setLoading(true);
        api.get(`/gamification/leaderboard?period=${period}`)
            .then((res) => setRows(res.data))
            .catch(() => addToast('Failed to load leaderboard', 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [period]); // eslint-disable-line

    const exportCsv = async () => {
        try {
            const res = await api.get(`/gamification/leaderboard?period=${period}&export=csv`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url; a.download = `leaderboard-${period}.csv`; a.click();
            window.URL.revokeObjectURL(url);
        } catch { addToast('Export failed', 'error'); }
    };

    const recalc = async () => {
        try { await api.post('/gamification/recalculate'); addToast('XP recalculated', 'success'); load(); }
        catch { addToast('Recalculate failed', 'error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {PERIODS.map((p) => (
                        <button key={p.key} onClick={() => setPeriod(p.key)} className="btn"
                            style={{
                                padding: '0.4rem 0.9rem',
                                background: period === p.key ? 'var(--primary)' : 'var(--bg-card)',
                                color: period === p.key ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid var(--border-color)'
                            }}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={recalc}><RefreshCw size={15} /> Recalculate</button>
                    <button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
                </div>
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Trophy size={32} style={{ opacity: 0.4 }} /><div>No ranked members for this period yet.</div>
                </div>
            ) : (
                <div className="card" style={{ padding: '1.5rem' }}>
                    <table className="modern-table">
                        <thead><tr><th>Rank</th><th>Member</th><th>League</th><th>Level</th><th>Streak</th><th>XP</th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.clientId} style={{ cursor: 'pointer' }} onClick={() => setSelected(r.clientId)}>
                                    <td style={{ fontWeight: 800, fontSize: '1rem' }}>{medal(r.rank)}</td>
                                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                                    <td>{r.league ? (
                                        <span className="status-badge" style={{ background: `${r.league.color}22`, color: r.league.color, padding: '3px 10px', borderRadius: 8 }}>{r.league.name}</span>
                                    ) : '—'}</td>
                                    <td>Lv {r.level}</td>
                                    <td>{r.currentStreak > 0 ? `${r.currentStreak}🔥` : '—'}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(r.xp).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <MemberProfileModal clientId={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
        </div>
    );
};

export default LeaderboardPanel;
