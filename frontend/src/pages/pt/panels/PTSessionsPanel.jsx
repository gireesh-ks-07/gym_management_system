import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ptApi } from '../../../api/pt';
import api from '../../../api';
import { Search, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import SessionModal from '../SessionModal';

const STATUS_BADGE = { completed: 'badge-success', scheduled: 'badge-info', cancelled: 'badge-warning', no_show: 'badge-danger' };
const STATUS_FILTERS = [
    { key: '', label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'no_show', label: 'No-show' }
];
const fmt = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PTSessionsPanel = () => {
    const { facilitySubscription } = useAuth();
    const facilityId = facilitySubscription?.id;
    const { addToast, showConfirm } = useToast();

    const [sessions, setSessions] = useState([]);
    const [members, setMembers] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [trainerFilter, setTrainerFilter] = useState('');
    const [modal, setModal] = useState({ open: false, session: null });

    const load = async () => {
        try {
            setLoading(true);
            const params = { facilityId };
            if (statusFilter) params.status = statusFilter;
            if (trainerFilter) params.trainerId = trainerFilter;
            const [sess, mem, staffRes] = await Promise.all([
                ptApi.getSessions(params),
                ptApi.getMembers(facilityId),
                api.get('/staff').catch(() => ({ data: [] }))
            ]);
            setSessions(sess);
            setMembers(mem);
            setTrainers(staffRes.data || []);
        } catch (e) { addToast('Failed to load sessions', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [facilityId, statusFilter, trainerFilter]);

    const quickStatus = async (s, status) => {
        try {
            await ptApi.updateSession(s.id, { status });
            addToast(`Session marked ${status.replace('_', '-')}`, 'success');
            load();
        } catch (err) {
            const data = err.response?.data;
            addToast(data?.message || 'Failed to update session', 'error');
        }
    };

    const remove = (s) => showConfirm(`Delete this PT session for ${s.Client?.name || 'member'}?`, async () => {
        try { await ptApi.deleteSession(s.id); addToast('Session deleted', 'success'); load(); }
        catch (e) { addToast('Failed to delete session', 'error'); }
    }, 'Delete Session');

    const filtered = sessions.filter((s) => `${s.Client?.name || ''} ${s.trainer?.name || ''}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                        <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                        <input type="text" placeholder="Search member or trainer…" value={search} onChange={(e) => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                    </div>
                    <select className="input-field" style={{ width: 'auto', minWidth: 150 }} value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)}>
                        <option value="">All Trainers</option>
                        {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => setModal({ open: true, session: null })}><Plus size={18} /> Log Session</button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {STATUS_FILTERS.map((s) => {
                        const active = statusFilter === s.key;
                        return <button key={s.label} onClick={() => setStatusFilter(s.key)} style={{
                            padding: '5px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${active ? 'transparent' : 'var(--border-color)'}`,
                            background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)'
                        }}>{s.label}</button>;
                    })}
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>
                ) : (
                    <div className="table-responsive" style={{ padding: '0.5rem' }}>
                        <table className="modern-table">
                            <thead><tr><th>Date & Time</th><th>Member</th><th>Trainer</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                            <tbody>
                                {filtered.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ fontSize: '0.85rem' }}>{fmt(s.sessionDate)}{s.notes ? <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: 260 }}>{s.notes}</div> : null}</td>
                                        <td style={{ fontWeight: 600 }}>{s.Client?.name || '—'}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{s.trainer?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[s.status] || 'badge-info'}`}>{s.status.replace('_', '-').toUpperCase()}</span>
                                            {s.overrideUsed ? <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--warning, #F59E0B)' }}>override</span> : null}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {s.status === 'scheduled' && <button className="icon-btn" title="Mark completed" style={{ color: 'var(--success, #22C55E)' }} onClick={() => quickStatus(s, 'completed')}><CheckCircle size={16} /></button>}
                                            {s.status === 'scheduled' && <button className="icon-btn" title="Mark no-show" style={{ color: 'var(--danger, #EF4444)' }} onClick={() => quickStatus(s, 'no_show')}><XCircle size={16} /></button>}
                                            <button className="icon-btn" title="Edit" onClick={() => setModal({ open: true, session: s })}><Pencil size={16} /></button>
                                            <button className="icon-btn" title="Delete" style={{ color: 'var(--danger, #EF4444)' }} onClick={() => remove(s)}><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No sessions found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <SessionModal
                isOpen={modal.open}
                onClose={() => setModal({ open: false, session: null })}
                onSaved={load}
                session={modal.session}
                members={members}
                trainers={trainers}
            />
        </div>
    );
};

export default PTSessionsPanel;
