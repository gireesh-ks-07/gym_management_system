import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, MapPin, ShieldCheck, Dumbbell, Users, Calendar } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Gyms = () => {
    const [gyms, setGyms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentGymId, setCurrentGymId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: ''
    });
    const [plans, setPlans] = useState([]);
    // Updated subscription modal state to hold full gym object and tab
    const [subscriptionModal, setSubscriptionModal] = useState({ isOpen: false, gym: null, tab: 'plan' });
    const [manualData, setManualData] = useState({ status: '', expiresAt: '' });

    const { addToast } = useToast();
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDangerous: false
    });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchGyms = async () => {
        try {
            const res = await api.get('/gyms');
            const plansRes = await api.get('/subscription-plans');
            setGyms(res.data);
            setPlans(plansRes.data);
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch data', 'error');
        }
    };

    useEffect(() => {
        fetchGyms();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '' });
            setShowModal(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '' });
        setShowModal(true);
    };

    const handleEditClick = (gym) => {
        setIsEditMode(true);
        setCurrentGymId(gym.id);
        setFormData({
            name: gym.name,
            address: gym.address || '',
            adminEmail: '',
            adminPassword: '',
            adminName: ''
        });
        setShowModal(true);
    };

    const deleteGym = async (gymId) => {
        try {
            await api.delete(`/gyms/${gymId}`);
            addToast('Gym deleted successfully', 'success');
            fetchGyms();
        } catch (err) {
            addToast('Failed to delete gym', 'error');
        }
    };

    const handleDeleteClick = (gymId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Gym',
            message: 'Are you sure you want to delete this gym? This action cannot be undone.',
            onConfirm: () => deleteGym(gymId),
            isDangerous: true,
            confirmText: 'Delete'
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            addToast('Gym name is required', 'error');
            return;
        }

        if (!isEditMode) {
            if (!formData.adminEmail || !formData.adminPassword || !formData.adminName) {
                addToast('Please fill in all required fields for the initial administrator', 'error');
                return;
            }
            if (!formData.adminEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                addToast('Please enter a valid administrator email address', 'error');
                return;
            }
            if (formData.adminPassword.length < 6) {
                addToast('Admin password must be at least 6 characters', 'error');
                return;
            }
        }

        try {
            if (isEditMode) {
                await api.put(`/gyms/${currentGymId}`, {
                    name: formData.name,
                    address: formData.address
                });
                addToast('Gym updated successfully', 'success');
            } else {
                await api.post('/gyms', formData);
                addToast('Gym created successfully', 'success');
            }
            setShowModal(false);
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '' });
            fetchGyms();
        } catch (err) {
            addToast(isEditMode ? 'Failed to update gym' : 'Failed to create gym', 'error');
        }
    };

    const openSubscriptionModal = (gym) => {
        const expires = gym.subscriptionExpiresAt ? new Date(gym.subscriptionExpiresAt).toISOString().split('T')[0] : '';
        setManualData({ status: gym.subscriptionStatus, expiresAt: expires });
        setSubscriptionModal({ isOpen: true, gym: gym, tab: 'plan', selectedPlanId: gym.subscriptionPlanId });
    };

    const handlePlanChange = async () => {
        if (!subscriptionModal.selectedPlanId) return addToast('Please select a plan', 'error');
        try {
            await api.post(`/gyms/${subscriptionModal.gym.id}/assign-plan`, { planId: subscriptionModal.selectedPlanId });
            addToast('Plan assigned successfully', 'success');
            setSubscriptionModal({ ...subscriptionModal, isOpen: false });
            fetchGyms();
        } catch (err) {
            addToast('Failed to assign plan', 'error');
        }
    };

    const handleManualUpdate = async () => {
        try {
            const payload = { ...manualData };
            if (!payload.expiresAt) delete payload.expiresAt;
            await api.post(`/gyms/${subscriptionModal.gym.id}/subscription-update`, payload);
            addToast('Subscription updated successfully', 'success');
            setSubscriptionModal({ ...subscriptionModal, isOpen: false });
            fetchGyms();
        } catch (err) {
            addToast('Failed to update subscription', 'error');
        }
    };


    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Gym Locations</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage all fitness centers and administrators</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add New Gym</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
                {gyms.map((gym, index) => (
                    <div className="card" key={gym.id} style={{
                        animationDelay: `${index * 0.1}s`,
                        padding: '0',
                        overflow: 'visible',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), transparent)',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            borderTopLeftRadius: 'var(--radius-md)',
                            borderTopRightRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                                <Dumbbell size={24} />
                            </div>
                            <ActionMenu
                                onEdit={() => handleEditClick(gym)}
                                onDelete={() => handleDeleteClick(gym.id)}
                            />
                        </div>

                        <div style={{ padding: '1.5rem', flex: 1 }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-highlight)' }}>{gym.name}</h3>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                <MapPin size={16} color="var(--accent-orange)" />
                                {gym.address || 'No address provided'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <Users size={16} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>{gym.Users ? gym.Users.length : 0} Staff Members</span>
                            </div>
                        </div>

                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid var(--border-color)',
                            background: 'rgba(0,0,0,0.2)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <ShieldCheck size={14} />
                                <span>ID: #{gym.id} • Created: {new Date(gym.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.8rem' }}>
                                    <div style={{ color: 'var(--text-secondary)' }}>Status</div>
                                    <div style={{
                                        color: gym.subscriptionStatus === 'active' ? 'var(--success)' : 'var(--danger)',
                                        fontWeight: '600', textTransform: 'uppercase', fontSize: '0.75rem'
                                    }}>
                                        {gym.subscriptionStatus}
                                    </div>
                                    {gym.subscriptionExpiresAt && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Exp: {new Date(gym.subscriptionExpiresAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => openSubscriptionModal(gym)}>
                                    Manage Subscription
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {gyms.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Dumbbell size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No gyms found. Click "Add New Gym" to get started.</p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Gym Details' : 'Register New Gym'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Gym Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Gold's Gym Downtown" />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Address</label>
                        <input className="input-field" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="e.g. 123 Main St, New York" />
                    </div>

                    {!isEditMode && (
                        <>
                            <div className="input-group">
                                <label className="input-label">Subscription Plan</label>
                                <select
                                    className="input-field"
                                    value={formData.planId}
                                    onChange={e => setFormData({ ...formData, planId: e.target.value })}
                                >
                                    <option value="">Select a Plan</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - ₹{p.price}/{p.duration}mo</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ margin: '1.5rem 0', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.05em', fontWeight: '600' }}>Initial Administrator</h3>
                                <div className="input-group">
                                    <label className="input-label">Admin Name</label>
                                    <input className="input-field" required value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} placeholder="Full Name" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Email</label>
                                    <input className="input-field" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} placeholder="admin@gym.com" />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">Password</label>
                                    <input className="input-field" type="password" required value={formData.adminPassword} onChange={e => setFormData({ ...formData, adminPassword: e.target.value })} placeholder="••••••••" />
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Create Gym'}</button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={subscriptionModal.isOpen}
                onClose={() => setSubscriptionModal({ ...subscriptionModal, isOpen: false })}
                title="Manage Subscription"
            >
                <div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            style={{
                                padding: '0.75rem 1rem',
                                borderBottom: subscriptionModal.tab === 'plan' ? '2px solid var(--primary)' : '2px solid transparent',
                                color: subscriptionModal.tab === 'plan' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: '500',
                                background: 'transparent',
                                border: 'none',
                                borderBottomWidth: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setSubscriptionModal({ ...subscriptionModal, tab: 'plan' })}
                        >
                            Change Plan
                        </button>
                        <button
                            style={{
                                padding: '0.75rem 1rem',
                                borderBottom: subscriptionModal.tab === 'manual' ? '2px solid var(--primary)' : '2px solid transparent',
                                color: subscriptionModal.tab === 'manual' ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: '500',
                                background: 'transparent',
                                border: 'none',
                                borderBottomWidth: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setSubscriptionModal({ ...subscriptionModal, tab: 'manual' })}
                        >
                            Manual Override
                        </button>
                    </div>

                    {subscriptionModal.tab === 'plan' ? (
                        <div>
                            <div className="input-group">
                                <label className="input-label">Assign Plan</label>
                                <select
                                    className="input-field"
                                    value={subscriptionModal.selectedPlanId || ''}
                                    onChange={e => setSubscriptionModal({ ...subscriptionModal, selectedPlanId: e.target.value })}
                                >
                                    <option value="">Select a Plan</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - ₹{p.price}/{p.duration}mo</option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Assigning a plan will automatically set the expiry date based on the plan duration from today.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setSubscriptionModal({ ...subscriptionModal, isOpen: false })}>Cancel</button>
                                <button className="btn btn-primary" onClick={handlePlanChange}>Update Plan</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="input-group">
                                <label className="input-label">Subscription Status</label>
                                <select
                                    className="input-field"
                                    value={manualData.status}
                                    onChange={e => setManualData({ ...manualData, status: e.target.value })}
                                >
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="expired">Expired</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Expiry Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={manualData.expiresAt}
                                    onChange={e => setManualData({ ...manualData, expiresAt: e.target.value })}
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Manually set the expiry date. This overrides the plan's default duration.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setSubscriptionModal({ ...subscriptionModal, isOpen: false })}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleManualUpdate}>Save Changes</button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                isDangerous={confirmModal.isDangerous}
                confirmText={confirmModal.confirmText}
            />
        </div>
    );
};

export default Gyms;
