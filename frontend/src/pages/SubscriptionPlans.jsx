import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Tag, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/Modal';

const SubscriptionPlans = () => {
    const [plans, setPlans] = useState([]);
    const { addToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '', price: '', duration: '', maxMembers: '', maxTrainers: '', description: ''
    });

    // Not implementing delete/edit for simplicity yet, only Create and List per instructions
    // "Create subscription plans"

    const fetchPlans = async () => {
        try {
            const res = await api.get('/subscription-plans');
            setPlans(res.data);
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch subscription plans', 'error');
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subscription-plans', formData);
            addToast('Subscription Plan created successfully', 'success');
            setFormData({ name: '', price: '', duration: '', maxMembers: '', maxTrainers: '', description: '' });
            setShowModal(false);
            fetchPlans();
        } catch (err) {
            addToast('Failed to create plan', 'error');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>SaaS Subscription Plans</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage platform subscription tiers for Gyms</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} />
                    <span>Create Plan</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                {plans.map((plan, index) => (
                    <div className="card" key={plan.id} style={{
                        padding: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        borderTop: `4px solid ${index % 2 === 0 ? 'var(--primary)' : 'var(--accent-purple)'}`,
                        animationDelay: `${index * 0.1}s`
                    }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-highlight)' }}>{plan.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-highlight)' }}>₹{plan.price}</span>
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {plan.duration} mo</span>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6', flex: 1 }}>
                            {plan.description || 'No description provided.'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>Up to {plan.maxMembers || 'Unlimited'} Members</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>Up to {plan.maxTrainers || 'Unlimited'} Trainers</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Create Subscription Plan"
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Plan Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Enterprise" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Price (₹)</label>
                            <input className="input-field" required type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="5000" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Duration (Months)</label>
                            <input className="input-field" required type="number" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} placeholder="12" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Max Members</label>
                            <input className="input-field" type="number" value={formData.maxMembers} onChange={e => setFormData({ ...formData, maxMembers: e.target.value })} placeholder="Optional" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Max Trainers</label>
                            <input className="input-field" type="number" value={formData.maxTrainers} onChange={e => setFormData({ ...formData, maxTrainers: e.target.value })} placeholder="Optional" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Description</label>
                        <textarea
                            className="input-field"
                            rows="3"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Plan details..."
                            style={{ resize: 'none' }}
                        />
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Create Plan</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SubscriptionPlans;
