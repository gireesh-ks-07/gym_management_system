import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, DollarSign, Calendar, CreditCard } from 'lucide-react';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';

const Payments = () => {
    const [payments, setPayments] = useState([]);
    const [clients, setClients] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        clientId: '', amount: '', method: 'cash', date: new Date().toISOString().split('T')[0]
    });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            const [pRes, cRes] = await Promise.all([
                api.get('/payments'),
                api.get('/clients')
            ]);
            setPayments(pRes.data);
            setClients(cRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setShowModal(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/payments', formData);
            setShowModal(false);
            setFormData({ clientId: '', amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (err) {
            alert('Failed to record payment');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Payments</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track revenue and transaction history</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} />
                    <span>Record Payment</span>
                </button>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                    <div className="input-group" style={{ marginBottom: 0, flex: 1, maxWidth: '300px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input-field"
                                placeholder="Search transactions..."
                                style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Client Name</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, index) => (
                                <tr key={p.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                    <td style={{ paddingLeft: '2rem' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{p.Client?.name || 'Unknown Client'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{p.clientId}</div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: '700', color: 'var(--success)', fontSize: '1rem' }}>₹{p.amount}</span>
                                    </td>
                                    <td>
                                        <span className="status-badge" style={{
                                            background: p.method === 'upi' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            color: p.method === 'upi' ? '#a78bfa' : '#34d399',
                                            borderColor: 'transparent',
                                            textTransform: 'uppercase'
                                        }}>
                                            {p.method === 'upi' ? <CreditCard size={12} style={{ marginRight: '4px' }} /> : <DollarSign size={12} style={{ marginRight: '4px' }} />}
                                            {p.method}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={14} />
                                            {new Date(p.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="status-badge status-active">Completed</span>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                        No transactions found. Record a new payment to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Record New Payment"
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Select Member</label>
                        <select className="input-field" required value={formData.clientId} onChange={e => setFormData({ ...formData, clientId: e.target.value })}>
                            <option value="">-- Choose Member --</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Amount (₹)</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>₹</span>
                            <input className="input-field" type="number" required min="1" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={{ paddingLeft: '2rem' }} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Payment Method</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem',
                                border: formData.method === 'cash' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)', flex: 1,
                                background: formData.method === 'cash' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)',
                                color: formData.method === 'cash' ? 'var(--primary)' : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}>
                                <input type="radio" name="method" value="cash" checked={formData.method === 'cash'} onChange={() => setFormData({ ...formData, method: 'cash' })} style={{ display: 'none' }} />
                                <DollarSign size={20} /> <span style={{ fontWeight: '500' }}>Cash</span>
                            </label>
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem',
                                border: formData.method === 'upi' ? '2px solid var(--accent-purple)' : '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)', flex: 1,
                                background: formData.method === 'upi' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                color: formData.method === 'upi' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}>
                                <input type="radio" name="method" value="upi" checked={formData.method === 'upi'} onChange={() => setFormData({ ...formData, method: 'upi' })} style={{ display: 'none' }} />
                                <CreditCard size={20} /> <span style={{ fontWeight: '500' }}>UPI / Card</span>
                            </label>
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Date</label>
                        <input className="input-field" type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Confirm Payment</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Payments;
