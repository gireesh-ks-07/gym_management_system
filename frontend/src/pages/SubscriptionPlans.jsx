import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Plus, Tag, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';
import { toTitleCase } from '../utils/textCase';

const SubscriptionPlans = () => {
    const [plans, setPlans] = useState([]);
    const { addToast, showConfirm } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentPlanId, setCurrentPlanId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', price: '', duration: '', maxMembers: '', maxStaff: '', description: ''
    });
    const location = useLocation();
    const navigate = useNavigate();

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

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', price: '', duration: '', maxMembers: '', maxStaff: '', description: '' });
            setShowModal(true);
            queryParams.delete('action');
            const nextSearch = queryParams.toString();
            navigate(
                {
                    pathname: location.pathname,
                    search: nextSearch ? `?${nextSearch}` : ''
                },
                { replace: true }
            );
        }
    }, [location, navigate]);

    const searchText = (new URLSearchParams(location.search).get('q') || '').trim().toLowerCase();
    const filteredPlans = useMemo(() => {
        return plans.filter((plan) => {
            const haystack = [
                plan.name,
                plan.description,
                plan.price != null ? String(plan.price) : '',
                plan.duration != null ? String(plan.duration) : '',
                plan.maxMembers != null ? String(plan.maxMembers) : '',
                plan.maxStaff != null ? String(plan.maxStaff) : ''
            ]
                .join(' ')
                .toLowerCase();
            return !searchText || haystack.includes(searchText);
        });
    }, [plans, searchText]);

    const handleEditClick = (plan) => {
        setIsEditMode(true);
        setCurrentPlanId(plan.id);
        setFormData({
            name: plan.name,
            price: plan.price,
            duration: plan.duration,
            maxMembers: plan.maxMembers || '',
            maxStaff: plan.maxStaff || '',
            description: plan.description || ''
        });
        setShowModal(true);
    };

    const deletePlan = async (planId) => {
        try {
            await api.delete(`/subscription-plans/${planId}`);
            addToast('Plan deleted successfully', 'success');
            fetchPlans();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete plan', 'error');
        }
    };

    const handleDeleteClick = (planId) => {
        showConfirm(
            'Are you sure you want to delete this subscription plan? Associated facilities might be affected.',
            () => deletePlan(planId),
            'Delete Subscription Plan'
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await api.put(`/subscription-plans/${currentPlanId}`, formData);
                addToast('Plan updated successfully', 'success');
            } else {
                await api.post('/subscription-plans', formData);
                addToast('Subscription Plan created successfully', 'success');
            }
            setFormData({ name: '', price: '', duration: '', maxMembers: '', maxStaff: '', description: '' });
            setShowModal(false);
            fetchPlans();
        } catch (err) {
            addToast(isEditMode ? 'Failed to update plan' : 'Failed to create plan', 'error');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>SaaS Subscription Plans</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage platform subscription tiers for Facilities</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setIsEditMode(false);
                    setFormData({ name: '', price: '', duration: '', maxMembers: '', maxStaff: '', description: '' });
                    setShowModal(true);
                }}>
                    <Plus size={18} />
                    <span>Create Plan</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                {filteredPlans.map((plan, index) => (
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

                        <div style={{ position: 'absolute', top: '1rem', right: '0.5rem' }}>
                            <ActionMenu
                                onEdit={() => handleEditClick(plan)}
                                onDelete={() => handleDeleteClick(plan.id)}
                            />
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
                                <span>Up to {plan.maxStaff || 'Unlimited'} Staff</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredPlans.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                    {searchText ? 'No subscription plans match your search.' : 'No subscription plans found.'}
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
            >
                <div>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Plan Name</label>
                            <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })} placeholder="e.g. Enterprise" />
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
                                <label className="input-label">Max Staff</label>
                                <input className="input-field" type="number" value={formData.maxStaff} onChange={e => setFormData({ ...formData, maxStaff: e.target.value })} placeholder="Optional" />
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
                            <button type="submit" className="btn btn-primary">{isEditMode ? 'Update Plan' : 'Create Plan'}</button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default SubscriptionPlans;
