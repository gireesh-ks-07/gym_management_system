import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { DollarSign, CreditCard } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const RecordPaymentModal = ({ isOpen, onClose, clients, preSelectedClientId = '', onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        clientId: preSelectedClientId,
        amount: '',
        method: 'cash',
        date: new Date().toISOString().split('T')[0]
    });

    // Update clientId if preSelectedClientId changes
    useEffect(() => {
        setFormData(prev => ({ ...prev, clientId: preSelectedClientId }));
    }, [preSelectedClientId, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.clientId) {
            addToast('Please select a member', 'error');
            return;
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            addToast('Please enter a valid amount', 'error');
            return;
        }

        try {
            await api.post('/payments', formData);
            if (onSuccess) onSuccess();
            onClose();
            setFormData({ clientId: '', amount: '', method: 'cash', date: new Date().toISOString().split('T')[0] });
            addToast('Payment recorded successfully', 'success');
        } catch (err) {
            addToast('Failed to record payment', 'error');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
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
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Confirm Payment</button>
                </div>
            </form>
        </Modal>
    );
};

export default RecordPaymentModal;
