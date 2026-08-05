import React, { useEffect, useState } from 'react';
import api from '../../../api';
import Modal from '../../../components/Modal';
import { useToast } from '../../../context/ToastContext';
import { Zap, Flame, RotateCcw, Award } from 'lucide-react';

const Stat = ({ label, value, color }) => (
    <div className="card" style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--text-highlight)' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
    </div>
);

const MemberProfileModal = ({ clientId, isOpen, onClose }) => {
    const { addToast, showConfirm } = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [xpDelta, setXpDelta] = useState('');

    const load = () => {
        if (!clientId) return;
        setLoading(true);
        api.get(`/gamification/members/${clientId}`)
            .then((res) => setData(res.data))
            .catch(() => addToast('Failed to load member profile', 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { if (isOpen) load(); /* eslint-disable-next-line */ }, [isOpen, clientId]);

    const adjustXp = async () => {
        const amount = parseInt(xpDelta, 10);
        if (!amount) return addToast('Enter a non-zero amount', 'error');
        try {
            await api.post(`/gamification/members/${clientId}/adjust-xp`, { amount });
            addToast('XP adjusted', 'success');
            setXpDelta('');
            load();
        } catch { addToast('Failed to adjust XP', 'error'); }
    };

    const resetStreak = () => showConfirm('Reset this member\'s current streak to 0?', async () => {
        try { await api.post(`/gamification/members/${clientId}/reset-streak`); addToast('Streak reset', 'success'); load(); }
        catch { addToast('Failed to reset streak', 'error'); }
    }, 'Reset Streak');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={data ? `${data.client.name} · Gamification` : 'Member Profile'}>
            {loading || !data ? (
                <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading…</div>
            ) : (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <Stat label="Level" value={`Lv ${data.profile.level}`} color="var(--primary)" />
                        <Stat label="Balance XP" value={data.profile.totalXp} />
                        <Stat label="Lifetime XP" value={data.profile.lifetimeXp} color="#F59E0B" />
                        <Stat label="Streak" value={`${data.profile.currentStreak}🔥`} color="#EF4444" />
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            <span>{data.league?.name || 'Unranked'}</span>
                            <span>{data.progress.percent}% to Lv {data.profile.level + 1}</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg-body)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${data.progress.percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--primary-light))' }} />
                        </div>
                    </div>

                    {/* Admin actions */}
                    <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>ADMIN ACTIONS</div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="input-field" style={{ width: 130 }} type="number" placeholder="± XP" value={xpDelta} onChange={(e) => setXpDelta(e.target.value)} />
                            <button className="btn btn-primary" onClick={adjustXp}><Zap size={15} /> Adjust XP</button>
                            <button className="btn btn-secondary" onClick={resetStreak}><RotateCcw size={15} /> Reset Streak</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}><Award size={14} /> Badges ({data.badges.length})</div>
                            {data.badges.length ? data.badges.map((b) => (
                                <div key={b.id} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '2px 0' }}>🏅 {b.Achievement?.name}</div>
                            )) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None yet</div>}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}><Flame size={14} /> Recent XP</div>
                            {data.recentXp.slice(0, 6).map((x) => (
                                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                    <span>{x.ruleCode}</span>
                                    <span style={{ color: x.xp >= 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 700 }}>{x.xp >= 0 ? '+' : ''}{x.xp}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default MemberProfileModal;
