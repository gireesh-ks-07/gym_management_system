import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, DollarSign, Calendar, CreditCard } from 'lucide-react';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';

const Payments = () => {
    const [payments, setPayments] = useState([]);
    const [clients, setClients] = useState([]);
    const [showModal, setShowModal] = useState(false);

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
                                <th style={{ paddingLeft: '2rem' }}>Payment Info</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, index) => (
                                <tr key={p.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                    <td style={{ paddingLeft: '2rem' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{p.Client?.name || 'Unknown Client'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                                            <span>Pay ID: #{p.id}</span>
                                            <span>•</span>
                                            <span>By: {p.processor?.name || 'System'}</span>
                                        </div>
                                        {(p.paymentId || p.transactionId) && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                                Payment ID: {p.paymentId || p.transactionId}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '700', color: 'var(--success)', fontSize: '1rem' }}>₹{p.amount}</div>
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
                                            {formatDate(p.date)}
                                        </div>
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

            <RecordPaymentModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                clients={clients}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default Payments;
