import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Tag, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';
import { toTitleCase } from '../utils/textCase';

const Plans = () => {
    const [plans, setPlans] = useState([]);
    const { addToast, showConfirm } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentPlanId, setCurrentPlanId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', price: '', duration: '', description: '', features: ''
    });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchPlans = async () => {
        try {
            const res = await api.get('/plans');
            setPlans(res.data);
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch plans', 'error');
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', price: '', duration: '', description: '', features: '' });
            setShowModal(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleEditClick = (plan) => {
        setIsEditMode(true);
        setCurrentPlanId(plan.id);
        setFormData({
            name: plan.name,
            price: plan.price,
            duration: plan.duration,
            description: plan.description || '',
            features: plan.features ? (Array.isArray(plan.features) ? plan.features.join('\n') : plan.features) : ''
        });
        setShowModal(true);
    };

    const deletePlan = async (planId) => {
        try {
            await api.delete(`/plans/${planId}`);
            addToast('Plan deleted successfully', 'success');
            fetchPlans();
        } catch (err) {
            addToast('Failed to delete plan', 'error');
        }
    };

    const handleDeleteClick = (planId) => {
        showConfirm(
            'Are you sure you want to delete this plan? This action cannot be undone.',
            () => deletePlan(planId),
            'Delete Plan'
        );
    };

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', price: '', duration: '', description: '', features: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            addToast('Plan name is required', 'error');
            return;
        }

        if (Number(formData.price) <= 0) {
            addToast('Price must be greater than 0', 'error');
            return;
        }

        if (Number(formData.duration) <= 0) {
            addToast('Duration must be at least 1 month', 'error');
            return;
        }

        try {
            const payload = {
                ...formData,
                features: formData.features.split('\n').filter(f => f.trim() !== '')
            };

            if (isEditMode) {
                await api.put(`/plans/${currentPlanId}`, payload);
                addToast('Plan updated successfully', 'success');
            } else {
                await api.post('/plans', payload);
                addToast('Plan created successfully', 'success');
            }
            setFormData({ name: '', price: '', duration: '', description: '', features: '' });
            setShowModal(false);
            fetchPlans();
        } catch (err) {
            addToast('Failed to save plan', 'error');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Membership Plans</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage your facility's subscription tiers</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Create Plan</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {plans.map((plan, index) => (
                    <div className="card" key={plan.id} style={{
                        padding: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-md)',
                        animationDelay: `${index * 0.1}s`,
                        minHeight: '380px'
                    }}>
                        <div style={{
                            height: '6px',
                            background: index % 2 === 0
                                ? 'linear-gradient(90deg, var(--primary), var(--primary-light))'
                                : 'linear-gradient(90deg, #3B82F6, #60A5FA)'
                        }}></div>

                        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '10px',
                                    fontSize: '0.7rem',
                                    fontWeight: '800',
                                    color: 'var(--primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {plan.duration} Mo Term
                                </div>
                                <ActionMenu
                                    onEdit={() => handleEditClick(plan)}
                                    onDelete={() => handleDeleteClick(plan.id)}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-highlight)', letterSpacing: '-0.01em', marginBottom: '0.25rem' }}>{plan.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                    <span style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-highlight)', letterSpacing: '-0.02em' }}>₹{plan.price}</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>/ term</span>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5', flex: 1 }}>
                                {plan.description || 'Includes full facility access and premium amenities.'}
                            </p>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                padding: '1rem',
                                background: 'var(--bg-body)',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.1rem' }}>Features</div>
                                {plan.features && Array.isArray(plan.features) && plan.features.length > 0 ? (
                                    plan.features.slice(0, 3).map((feature, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                            <CheckCircle size={16} color="var(--primary)" />
                                            <span>{feature}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No features listed.</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {plans.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Tag size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No plans created yet. Add your first membership plan!</p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Plan' : 'Create New Plan'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Plan Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })} placeholder="e.g. Gold Membership" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Price (₹)</label>
                            <input className="input-field" required type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="1500" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Duration (Months)</label>
                            <input className="input-field" required type="number" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} placeholder="1" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Description</label>
                        <textarea
                            className="input-field"
                            rows="3"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="List the key benefits..."
                            style={{ resize: 'none' }}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Features (One per line)</label>
                        <textarea
                            className="input-field"
                            rows="4"
                            value={formData.features}
                            onChange={e => {
                                const normalized = e.target.value
                                    .split('\n')
                                    .map((line) => toTitleCase(line))
                                    .join('\n');
                                setFormData({ ...formData, features: normalized });
                            }}
                            placeholder="All Equipment Access&#10;Free One-on-One Session&#10;Locker Access"
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>{isEditMode ? 'Save Changes' : 'Create Plan'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Plans;
