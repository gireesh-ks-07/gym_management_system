import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Tag, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';

const Plans = () => {
    const [plans, setPlans] = useState([]);
    const { addToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentPlanId, setCurrentPlanId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', price: '', duration: '', description: ''
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
            setFormData({ name: '', price: '', duration: '', description: '' });
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
            description: plan.description || ''
        });
        setShowModal(true);
    };

    const handleDeleteClick = async (planId) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            try {
                await api.delete(`/plans/${planId}`);
                addToast('Plan deleted successfully', 'success');
                fetchPlans();
            } catch (err) {
                addToast('Failed to delete plan', 'error');
            }
        }
    };

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', price: '', duration: '', description: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                // Mock success for now as PUT endpoint might be missing
                addToast('Plan updated (Mock)', 'success');
            } else {
                await api.post('/plans', formData);
                addToast('Plan created successfully', 'success');
            }
            setFormData({ name: '', price: '', duration: '', description: '' });
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
                    <p style={{ color: 'var(--text-secondary)' }}>Manage your gym's subscription tiers</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
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
                        overflow: 'visible',
                        animationDelay: `${index * 0.1}s`,
                        borderTop: `4px solid ${index % 2 === 0 ? 'var(--primary)' : 'var(--accent-blue)'}`
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '3rem',
                            background: 'rgba(255,255,255,0.1)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--text-highlight)'
                        }}>
                            {plan.duration} Month{plan.duration > 1 ? 's' : ''}
                        </div>

                        <div style={{ position: 'absolute', top: '1rem', right: '0.5rem' }}>
                            <ActionMenu
                                onDelete={() => handleDeleteClick(plan.id)}
                                deleteLabel="Delete Plan"
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-highlight)' }}>{plan.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-highlight)' }}>₹{plan.price}</span>
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ term</span>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6', flex: 1 }}>
                            {plan.description || 'Includes full gym access, locker usage, and steam room access.'}
                        </p>

                        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>All Equipment Access</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                <CheckCircle size={16} color="var(--primary)" />
                                <span>Free Fitness Assessment</span>
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
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Gold Membership" />
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
