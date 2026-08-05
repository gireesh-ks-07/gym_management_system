import React, { useEffect, useState } from 'react';
import api from '../../../api';
import { useToast } from '../../../context/ToastContext';
import { Check, X, Gift } from 'lucide-react';
import CrudTable from './CrudTable';

const RedemptionsQueue = () => {
    const { addToast } = useToast();
    const [rows, setRows] = useState([]);
    const [filter, setFilter] = useState('pending');

    const load = () => {
        api.get(`/gamification/redemptions${filter ? `?status=${filter}` : ''}`)
            .then((res) => setRows(res.data))
            .catch(() => addToast('Failed to load redemptions', 'error'));
    };
    useEffect(load, [filter]); // eslint-disable-line

    const act = async (id, action) => {
        try {
            await api.post(`/gamification/redemptions/${id}/${action}`);
            addToast(action === 'fulfill' ? 'Marked fulfilled' : 'Redemption cancelled & XP refunded', 'success');
            load();
        } catch { addToast('Action failed', 'error'); }
    };

    const statusColor = { pending: '#F59E0B', fulfilled: '#10B981', cancelled: '#6B7280' };

    return (
        <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Gift size={18} /> Redemption Requests</h3>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {['pending', 'fulfilled', 'cancelled', ''].map((s) => (
                        <button key={s || 'all'} onClick={() => setFilter(s)} className="btn"
                            style={{ padding: '0.35rem 0.8rem', background: filter === s ? 'var(--primary)' : 'var(--bg-card)', color: filter === s ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-color)', textTransform: 'capitalize' }}>
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No {filter || ''} redemptions.</div>
            ) : (
                <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead><tr><th>Member</th><th>Reward</th><th>XP</th><th>Status</th><th>Requested</th><th></th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 600 }}>{r.Client?.name || '—'}</td>
                                    <td>{r.Reward?.name || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>{r.xpSpent}</td>
                                    <td><span className="status-badge" style={{ padding: '3px 10px', borderRadius: 8, background: `${statusColor[r.status]}22`, color: statusColor[r.status], textTransform: 'capitalize' }}>{r.status}</span></td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(r.createdAt).toLocaleDateString('en-GB')}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {r.status === 'pending' && (
                                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                                                <button className="btn btn-primary" style={{ padding: '0.3rem 0.7rem' }} onClick={() => act(r.id, 'fulfill')}><Check size={14} /> Fulfill</button>
                                                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem' }} onClick={() => act(r.id, 'cancel')}><X size={14} /> Cancel</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const RewardsPanel = () => (
    <div>
        <CrudTable
            endpoint="/gamification/rewards"
            title="Reward"
            addLabel="Add Reward"
            emptyHint="No rewards in the store yet."
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'xpCost', label: 'XP Cost', render: (r) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.xpCost}</span> },
                { key: 'inventory', label: 'Inventory', render: (r) => (r.inventory == null ? 'Unlimited' : r.inventory) },
                { key: 'status', label: 'Status', render: (r) => (
                    <span className="status-badge" style={{ padding: '3px 10px', borderRadius: 8, background: r.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.15)', color: r.status === 'active' ? 'var(--primary)' : 'var(--inactive)' }}>{r.status}</span>
                ) }
            ]}
            fields={[
                { name: 'name', label: 'Name', required: true, half: true },
                { name: 'xpCost', label: 'XP Cost', type: 'number', required: true, half: true },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'image', label: 'Image URL', half: true },
                { name: 'inventory', label: 'Inventory (blank = ∞)', type: 'number', half: true },
                { name: 'expiry', label: 'Expiry', type: 'date', half: true },
                { name: 'status', label: 'Status', type: 'select', default: 'active', half: true, options: ['active', 'inactive'] }
            ]}
        />
        <RedemptionsQueue />
    </div>
);

export default RewardsPanel;
