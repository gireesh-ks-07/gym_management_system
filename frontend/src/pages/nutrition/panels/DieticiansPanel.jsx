import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { dieticianApi } from '../../../api/dietician';
import { Search, Stethoscope, Users } from 'lucide-react';

// Admin view: manage dieticians and assign members to them. A member can only
// be seen (and given a diet chart) by the dietician they are assigned to.
const DieticiansPanel = () => {
    const { facilitySubscription } = useAuth();
    const { addToast } = useToast();
    const facilityId = facilitySubscription?.id;

    const [dieticians, setDieticians] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [savingId, setSavingId] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const [d, c] = await Promise.all([
                dieticianApi.getDieticians(facilityId),
                dieticianApi.getClients(facilityId)
            ]);
            setDieticians(d);
            setClients(c);
        } catch (e) {
            addToast('Failed to load dieticians', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [facilityId]);

    const handleAssign = async (client, value) => {
        setSavingId(client.id);
        try {
            if (value === '') {
                await dieticianApi.unassignClient(client.id);
                addToast(`${client.name} unassigned`, 'success');
            } else {
                await dieticianApi.assignClient(parseInt(value, 10), client.id);
                addToast(`${client.name} assigned`, 'success');
            }
            await load();
        } catch (e) {
            addToast(e.response?.data?.error || 'Failed to update assignment', 'error');
        } finally {
            setSavingId(null);
        }
    };

    const filtered = clients.filter((c) =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search)
    );

    if (loading) {
        return <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>;
    }

    if (dieticians.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                <Stethoscope size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                <p>No dieticians yet. Add a dietician from the <b>Staff</b> section (choose the “Dietician” role), then assign members here.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Dietician summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {dieticians.map((d) => (
                    <div key={d.id} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.7rem', borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), #34D399)', color: '#fff', display: 'flex' }}>
                            <Stethoscope size={22} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Users size={13} /> {d.clientCount} member{d.clientCount === 1 ? '' : 's'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Member → dietician assignment table */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
                <div className="search-bar" style={{ maxWidth: 320 }}>
                    <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                    <input type="text" placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                <th style={th}>Member</th>
                                <th style={th}>Phone</th>
                                <th style={th}>Assigned Dietician</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td style={td}><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                                    <td style={td}>
                                        <select
                                            className="input-field"
                                            style={{ maxWidth: 260, opacity: savingId === c.id ? 0.5 : 1 }}
                                            disabled={savingId === c.id}
                                            value={c.dieticianId || ''}
                                            onChange={(e) => handleAssign(c, e.target.value)}
                                        >
                                            <option value="">— Unassigned —</option>
                                            {dieticians.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan="3" style={{ ...td, textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>No members found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const th = { padding: '0.9rem 1.25rem', fontWeight: 600 };
const td = { padding: '0.85rem 1.25rem', fontSize: '0.9rem' };

export default DieticiansPanel;
