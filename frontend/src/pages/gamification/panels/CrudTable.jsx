import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api';
import Modal from '../../../components/Modal';
import ActionMenu from '../../../components/ActionMenu';
import { useToast } from '../../../context/ToastContext';
import { Plus } from 'lucide-react';

// Generic config CRUD panel driven by a field schema.
// props:
//   endpoint  - e.g. '/gamification/leagues'
//   title, addLabel
//   columns   - [{ key, label, render? }]
//   fields    - [{ name, label, type, options?, required?, default?, half?, json? }]
//   emptyHint
const CrudTable = ({ endpoint, title, addLabel = 'Add', columns, fields, emptyHint }) => {
    const { addToast, showConfirm } = useToast();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({});

    const blank = useMemo(() => {
        const o = {};
        fields.forEach((f) => { o[f.name] = f.default != null ? f.default : (f.type === 'checkbox' ? false : ''); });
        return o;
    }, [fields]);

    const load = () => {
        setLoading(true);
        api.get(endpoint)
            .then((res) => setRows(res.data))
            .catch(() => addToast(`Failed to load ${title}`, 'error'))
            .finally(() => setLoading(false));
    };
    useEffect(load, [endpoint]); // eslint-disable-line

    const openAdd = () => { setEditId(null); setForm({ ...blank }); setShowModal(true); };
    const openEdit = (row) => {
        const o = {};
        fields.forEach((f) => {
            let v = row[f.name];
            if (f.json && v != null && typeof v === 'object') v = JSON.stringify(v);
            o[f.name] = v != null ? v : (f.type === 'checkbox' ? false : '');
        });
        setForm(o); setEditId(row.id); setShowModal(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        const payload = { ...form };
        // parse json + number fields
        for (const f of fields) {
            if (f.json && typeof payload[f.name] === 'string' && payload[f.name].trim()) {
                try { payload[f.name] = JSON.parse(payload[f.name]); }
                catch { return addToast(`${f.label} must be valid JSON`, 'error'); }
            }
            if (f.type === 'number' && payload[f.name] !== '' && payload[f.name] != null) payload[f.name] = Number(payload[f.name]);
        }
        try {
            if (editId) { await api.put(`${endpoint}/${editId}`, payload); addToast(`${title} updated`, 'success'); }
            else { await api.post(endpoint, payload); addToast(`${title} created`, 'success'); }
            setShowModal(false); load();
        } catch (err) { addToast(err.response?.data?.message || 'Save failed', 'error'); }
    };

    const remove = (row) => showConfirm(`Delete this ${title.toLowerCase()}?`, async () => {
        try { await api.delete(`${endpoint}/${row.id}`); addToast(`${title} deleted`, 'success'); load(); }
        catch { addToast('Delete failed', 'error'); }
    }, `Delete ${title}`);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> {addLabel}</button>
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{emptyHint || `No ${title.toLowerCase()} yet.`}</div>
            ) : (
                <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr></thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
                                    <td style={{ textAlign: 'right' }}>
                                        <ActionMenu onEdit={() => openEdit(row)} onDelete={() => remove(row)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? `Edit ${title}` : addLabel}>
                <form onSubmit={submit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {fields.map((f) => (
                            <div className="input-group" key={f.name} style={{ gridColumn: f.half ? 'span 1' : 'span 2', marginBottom: 0 }}>
                                <label className="input-label">{f.label}{f.required ? ' *' : ''}</label>
                                {f.type === 'textarea' || f.json ? (
                                    <textarea className="input-field" rows={f.json ? 2 : 3} required={f.required}
                                        value={form[f.name] ?? ''} placeholder={f.placeholder}
                                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} style={{ resize: 'vertical' }} />
                                ) : f.type === 'select' ? (
                                    <select className="input-field" required={f.required} value={form[f.name] ?? ''}
                                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                                        <option value="">Select…</option>
                                        {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
                                    </select>
                                ) : f.type === 'checkbox' ? (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                                        Enabled
                                    </label>
                                ) : (
                                    <input className="input-field" type={f.type || 'text'} required={f.required}
                                        value={form[f.name] ?? ''} placeholder={f.placeholder}
                                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Create'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CrudTable;
