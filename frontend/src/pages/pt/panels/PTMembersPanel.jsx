import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ptApi } from '../../../api/pt';
import api from '../../../api';
import { Search, Dumbbell, Plus, History } from 'lucide-react';
import Modal from '../../../components/Modal';
import SessionModal from '../SessionModal';
import UsageBar from '../UsageBar';

const STATUS_BADGE = { completed: 'badge-success', scheduled: 'badge-info', cancelled: 'badge-warning', no_show: 'badge-danger' };
const fmt = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PTMembersPanel = () => {
    const { facilitySubscription } = useAuth();
    const facilityId = facilitySubscription?.id;
    const { addToast } = useToast();

    const [members, setMembers] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [sessionModal, setSessionModal] = useState({ open: false, presetClientId: null });
    const [detail, setDetail] = useState({ open: false, data: null, loading: false });

    const load = async () => {
        try {
            setLoading(true);
            const [mem, staffRes] = await Promise.all([
                ptApi.getMembers(facilityId),
                api.get('/staff').catch(() => ({ data: [] }))
            ]);
            setMembers(mem);
            setTrainers(staffRes.data || []);
        } catch (e) { addToast('Failed to load PT members', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [facilityId]);

    const openDetail = async (member) => {
        setDetail({ open: true, data: null, loading: true });
        try {
            const data = await ptApi.getMemberDetail(member.id, facilityId);
            setDetail({ open: true, data, loading: false });
        } catch (e) {
            addToast('Failed to load session history', 'error');
            setDetail({ open: false, data: null, loading: false });
        }
    };

    const filtered = members.filter((m) => `${m.name} ${m.phone || ''}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                        <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                        <input type="text" placeholder="Search PT members…" value={search} onChange={(e) => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                    </div>
                    <button className="btn btn-primary" onClick={() => setSessionModal({ open: true, presetClientId: null })}><Plus size={18} /> Log Session</button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>
                ) : (
                    <div className="table-responsive" style={{ padding: '0.5rem' }}>
                        <table className="modern-table">
                            <thead><tr><th>Member</th><th>PT Plan</th><th>Allowance</th><th style={{ minWidth: 180 }}>Usage (this period)</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                            <tbody>
                                {filtered.map((m) => (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 600 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ background: 'var(--bg-active)', padding: 6, borderRadius: '50%', display: 'flex' }}><Dumbbell size={15} color="var(--primary)" /></span>
                                                {m.name}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{m.usage?.planName || '—'}</td>
                                        <td className="text-secondary" style={{ fontSize: '0.85rem' }}>
                                            {m.usage?.allowed} / {m.usage?.period === 'monthly' ? 'month' : 'week'}
                                        </td>
                                        <td><UsageBar usage={m.usage} /></td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button className="icon-btn" title="Log Session" onClick={() => setSessionModal({ open: true, presetClientId: m.id })}><Plus size={16} /></button>
                                            <button className="icon-btn" title="Session History" onClick={() => openDetail(m)}><History size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No members on a Personal Training plan.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <SessionModal
                isOpen={sessionModal.open}
                onClose={() => setSessionModal({ open: false, presetClientId: null })}
                onSaved={load}
                presetClientId={sessionModal.presetClientId}
                members={members}
                trainers={trainers}
            />

            <Modal isOpen={detail.open} onClose={() => setDetail({ open: false, data: null, loading: false })} title={detail.data ? `${detail.data.member.name} — PT Sessions` : 'PT Sessions'}>
                {detail.loading || !detail.data ? (
                    <div className="loader-container" style={{ minHeight: 120 }}><div className="loader-icon" /></div>
                ) : (
                    <div>
                        {detail.data.usage && (
                            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-body)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Personal Training</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                                    {detail.data.usage.used} / {detail.data.usage.allowed} sessions used
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}> · {detail.data.usage.remaining} remaining this {detail.data.usage.period === 'monthly' ? 'month' : 'week'}</span>
                                </div>
                                <div style={{ marginTop: 8 }}><UsageBar usage={detail.data.usage} /></div>
                            </div>
                        )}
                        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                            <table className="modern-table">
                                <thead><tr><th>Date</th><th>Trainer</th><th>Status</th></tr></thead>
                                <tbody>
                                    {detail.data.sessions.map((s) => (
                                        <tr key={s.id}>
                                            <td style={{ fontSize: '0.85rem' }}>{fmt(s.sessionDate)}{s.notes ? <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{s.notes}</div> : null}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{s.trainer?.name || '—'}</td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[s.status] || 'badge-info'}`}>{s.status.replace('_', '-').toUpperCase()}</span>
                                                {s.overrideUsed ? <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--warning, #F59E0B)' }}>override</span> : null}
                                            </td>
                                        </tr>
                                    ))}
                                    {detail.data.sessions.length === 0 && <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No sessions recorded yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PTMembersPanel;
