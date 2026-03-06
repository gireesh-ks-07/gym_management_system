import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Plus, MapPin, ShieldCheck, Dumbbell, Users, Calendar, Music, Activity, Sword, Heart, Layers, Mail } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import PasswordInput from '../components/PasswordInput';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';
import { toTitleCase } from '../utils/textCase';

const Facilities = () => {
    const [facilities, setFacilities] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentFacilityId, setCurrentFacilityId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '', facilityTypeId: '', healthProfileEnabled: false
    });
    const [plans, setPlans] = useState([]);
    const [facilityTypes, setFacilityTypes] = useState([]);
    // Updated subscription modal state to hold full facility object and tab
    const [subscriptionModal, setSubscriptionModal] = useState({ isOpen: false, facility: null, tab: 'plan' });
    const [manualData, setManualData] = useState({ status: '', expiresAt: '' });

    const { addToast, showConfirm } = useToast();
    const [passwordModal, setPasswordModal] = useState({ isOpen: false, facilityId: null, newPassword: '' });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchFacilities = async () => {
        try {
            const [facsRes, plansRes, typesRes] = await Promise.all([
                api.get('/facilities').catch(e => { console.error('Fac error', e); return { data: [] }; }),
                api.get('/subscription-plans').catch(e => { console.error('Plans error', e); return { data: [] }; }),
                api.get('/api/facility-types').catch(e => { console.error('Types error', e); return { data: [] }; })
            ]);

            setFacilities(facsRes.data);
            setPlans(plansRes.data || []);
            setFacilityTypes(typesRes.data || []);
        } catch (err) {
            console.error('General fetch error:', err);
            addToast('Failed to fetch data', 'error');
        }
    };

    useEffect(() => {
        fetchFacilities();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '', facilityTypeId: '', healthProfileEnabled: false });
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

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '', facilityTypeId: '', healthProfileEnabled: false });
        setShowModal(true);
    };

    const handleEditClick = (facility) => {
        setIsEditMode(true);
        setCurrentFacilityId(facility.id);
        setFormData({
            name: facility.name,
            address: facility.address || '',
            adminEmail: '',
            adminPassword: '',
            adminName: '',
            facilityTypeId: facility.facilityTypeId || '',
            healthProfileEnabled: Boolean(facility.healthProfileEnabled)
        });
        setShowModal(true);
    };

    const deleteFacility = async (facilityId) => {
        try {
            await api.delete(`/facilities/${facilityId}`);
            addToast('Facility deleted successfully', 'success');
            fetchFacilities();
        } catch (err) {
            addToast('Failed to delete facility', 'error');
        }
    };

    const handleDeleteClick = (facilityId) => {
        showConfirm(
            'Are you sure you want to delete this facility? This action cannot be undone and all associated data will be permanently removed.',
            () => deleteFacility(facilityId),
            'Delete Facility'
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            addToast('Facility name is required', 'error');
            return;
        }

        if (!isEditMode) {
            if (!formData.planId) {
                addToast('Please select a subscription plan', 'error');
                return;
            }
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
                await api.put(`/facilities/${currentFacilityId}`, {
                    name: formData.name,
                    type: formData.type,
                    address: formData.address,
                    facilityTypeId: formData.facilityTypeId || null
                    ,
                    healthProfileEnabled: Boolean(formData.healthProfileEnabled)
                });
                addToast('Facility updated successfully', 'success');
            } else {
                await api.post('/facilities', formData);
                addToast('Facility created successfully', 'success');
            }
            setShowModal(false);
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '', planId: '', facilityTypeId: '', healthProfileEnabled: false });
            fetchFacilities();
        } catch (err) {
            addToast(isEditMode ? 'Failed to update facility' : 'Failed to create facility', 'error');
        }
    };

    const openSubscriptionModal = (facility) => {
        const expires = facility.subscriptionExpiresAt ? new Date(facility.subscriptionExpiresAt).toISOString().split('T')[0] : '';
        setManualData({ status: facility.subscriptionStatus, expiresAt: expires });
        setSubscriptionModal({ isOpen: true, facility: facility, tab: 'plan', selectedPlanId: facility.subscriptionPlanId });
    };

    const handlePlanChange = async () => {
        if (!subscriptionModal.selectedPlanId) return addToast('Please select a plan', 'error');
        try {
            await api.post(`/facilities/${subscriptionModal.facility.id}/assign-plan`, { planId: subscriptionModal.selectedPlanId });
            addToast('Plan assigned successfully', 'success');
            setSubscriptionModal({ ...subscriptionModal, isOpen: false });
            fetchFacilities();
        } catch (err) {
            addToast('Failed to assign plan', 'error');
        }
    };

    const handleManualUpdate = async () => {
        try {
            const payload = { ...manualData };
            if (!payload.expiresAt) delete payload.expiresAt;
            await api.post(`/facilities/${subscriptionModal.facility.id}/subscription-update`, payload);
            addToast('Subscription updated successfully', 'success');
            setSubscriptionModal({ ...subscriptionModal, isOpen: false });
            fetchFacilities();
        } catch (err) {
            addToast('Failed to update subscription', 'error');
        }
    };


    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/facilities/${passwordModal.facilityId}/reset-password`, { newPassword: passwordModal.newPassword });
            addToast('Admin password reset successfully', 'success');
            setPasswordModal({ isOpen: false, facilityId: null, newPassword: '' });
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to reset password', 'error');
        }
    };

    const getTypeIcon = (facility) => {
        if (facility.FacilityType) {
            switch (facility.FacilityType.icon) {
                case 'Activity': return <Activity size={24} />;
                case 'Dumbbell': return <Dumbbell size={24} />;
                case 'Music': return <Music size={24} />;
                case 'Sword': return <Sword size={18} />;
                case 'Heart': return <Heart size={18} />;
                case 'Layers': return <Layers size={18} />;
                default: return <Activity size={24} />;
            }
        }
        switch (facility.type) {
            case 'dance_school': return <Music size={24} />;
            case 'gym': return <Dumbbell size={24} />;
            default: return <Activity size={24} />;
        }
    };

    const getTypeLabel = (facility) => {
        return facility.FacilityType ? facility.FacilityType.name : 'Uncategorized';
    };

    const getFacilityUserDetails = (facility) => {
        const fallbackAdminCount = facility.Users ? facility.Users.filter(u => u.role === 'admin').length : 0;
        const fallbackStaffCount = facility.Users ? facility.Users.filter(u => u.role === 'staff').length : 0;

        const adminCount = facility.userDetails?.adminCount ?? fallbackAdminCount;
        const staffCount = facility.userDetails?.staffCount ?? fallbackStaffCount;

        return {
            totalUsers: facility.userDetails?.totalUsers ?? (adminCount + staffCount),
            adminCount,
            staffCount,
            memberCount: facility.userDetails?.memberCount ?? 0
        };
    };

    const getFacilityAdminEmail = (facility) => {
        const adminUser = facility.Users?.find((u) => u.role === 'admin');
        return adminUser?.email || 'No admin email';
    };

    const queryParams = new URLSearchParams(location.search);
    const searchText = (queryParams.get('q') || '').trim().toLowerCase();
    const statusFilter = (queryParams.get('status') || '').trim().toLowerCase();

    const filteredFacilities = useMemo(() => {
        return facilities.filter((facility) => {
            const status = (facility.subscriptionStatus || '').toLowerCase();
            const planName = facility.SubscriptionPlan?.name || '';
            const facilityTypeName = facility.FacilityType?.name || '';
            const adminEmails = (facility.Users || [])
                .filter((u) => u.role === 'admin' && u.email)
                .map((u) => u.email)
                .join(' ');
            const haystack = [
                facility.name,
                facility.address,
                planName,
                facilityTypeName,
                adminEmails,
                facility.id ? String(facility.id) : '',
                status
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch = !searchText || haystack.includes(searchText);
            const matchesStatus =
                !statusFilter ||
                (statusFilter === 'active' && status === 'active') ||
                (statusFilter === 'inactive' && status !== 'active') ||
                status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [facilities, searchText, statusFilter]);

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Facilities</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage all facilities and administrators</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add New Facility</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                {filteredFacilities.map((facility, index) => {
                    const details = getFacilityUserDetails(facility);
                    const adminEmail = getFacilityAdminEmail(facility);
                    return (
                        <div className="card stat-card" key={facility.id} style={{
                            animationDelay: `${index * 0.1}s`,
                            padding: '0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '24px',
                            minHeight: '480px'
                        }}>
                            <div style={{
                                padding: '1.5rem',
                                background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                position: 'relative'
                            }}>
                                <div style={{
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '16px',
                                    color: 'white',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                                }}>
                                    {getTypeIcon(facility)}
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                    <ActionMenu
                                        onEdit={() => handleEditClick(facility)}
                                        onDelete={() => handleDeleteClick(facility.id)}
                                        onPasswordReset={() => setPasswordModal({ isOpen: true, facilityId: facility.id, newPassword: '' })}
                                    />
                                </div>
                            </div>

                            <div style={{ padding: '1.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-highlight)', letterSpacing: '-0.02em', marginBottom: '4px' }}>{facility.name}</h3>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            background: 'var(--primary-glow)',
                                            color: 'var(--primary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em'
                                        }}>
                                            {getTypeLabel(facility)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.9rem',
                                        background: 'var(--bg-body)',
                                        borderRadius: '14px',
                                        padding: '0.75rem 1rem',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <MapPin size={16} color="var(--primary)" />
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>
                                            {facility.address || 'No address provided'}
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.9rem',
                                        background: 'var(--bg-body)',
                                        borderRadius: '14px',
                                        padding: '0.75rem 1rem',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <Mail size={16} color="var(--primary)" />
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{adminEmail}</span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: 'var(--primary-glow)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--primary-light)',
                                    opacity: 0.9
                                }}>
                                    <Users size={18} color="var(--primary)" />
                                    <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: '700' }}>
                                        {details.totalUsers} Ecosystem Users
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    {[
                                        { label: 'Admins', value: details.adminCount },
                                        { label: 'Staff', value: details.staffCount },
                                        { label: 'Members', value: details.memberCount }
                                    ].map((stat) => (
                                        <div key={stat.label} style={{
                                            padding: '0.75rem 0.5rem',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '16px',
                                            textAlign: 'center',
                                            background: 'var(--bg-card)',
                                            boxShadow: 'var(--shadow-sm)'
                                        }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '4px' }}>{stat.label}</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-highlight)' }}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{
                                padding: '1.5rem',
                                borderTop: '1px solid var(--border-color)',
                                background: 'var(--bg-body)',
                                marginTop: 'auto'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem', fontWeight: '600' }}>
                                    <ShieldCheck size={14} color="var(--primary)" />
                                    <span>FID: {facility.id} • Registered {formatDate(facility.createdAt)}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px', letterSpacing: '0.05em' }}>Subscription</div>
                                        <span className={`status-badge ${facility.subscriptionStatus === 'active' ? 'status-active' :
                                            facility.subscriptionStatus === 'pending' ? 'status-payment-due' : 'status-inactive'
                                            }`} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '8px' }}>
                                            {facility.subscriptionStatus}
                                        </span>
                                    </div>
                                    <button
                                        className="btn btn-secondary"
                                        style={{
                                            fontSize: '0.8rem',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '12px',
                                            fontWeight: '700',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-card)'
                                        }}
                                        onClick={() => openSubscriptionModal(facility)}
                                    >
                                        Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredFacilities.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Dumbbell size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>
                        {searchText || statusFilter
                            ? 'No facilities match the current search/filter.'
                            : 'No facilities found. Click "Add New Facility" to get started.'}
                    </p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Facility Details' : 'Register New Facility'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Facility Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })} placeholder="e.g. Gold's Gym Downtown" />
                    </div>



                    <div className="input-group">
                        <label className="input-label">Facility Category</label>
                        <select
                            className="input-field"
                            value={formData.facilityTypeId}
                            onChange={e => setFormData({ ...formData, facilityTypeId: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {facilityTypes.map(ft => (
                                <option key={ft.id} value={ft.id}>{ft.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Address</label>
                        <input className="input-field" value={formData.address} onChange={e => setFormData({ ...formData, address: toTitleCase(e.target.value) })} placeholder="e.g. 123 Main St, New York" />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Health Profile Module</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                            <input
                                type="checkbox"
                                checked={Boolean(formData.healthProfileEnabled)}
                                onChange={e => setFormData({ ...formData, healthProfileEnabled: e.target.checked })}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>
                                Enable health profile, goals, and workout scheduling for this facility
                            </span>
                        </label>
                    </div>

                    {!isEditMode && (
                        <>
                            <div className="input-group">
                                <label className="input-label">Subscription Plan</label>
                                <select
                                    className="input-field"
                                    required
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
                                    <input className="input-field" required value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: toTitleCase(e.target.value) })} placeholder="Full Name" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Email</label>
                                    <input className="input-field" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} placeholder="admin@facility.com" />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">Password</label>
                                    <PasswordInput
                                        required
                                        value={formData.adminPassword}
                                        onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-grid">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Create Facility'}</button>
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
                                    Changing a plan will revoke existing AutoPay (if any), reset status to Pending, and require the facility admin to subscribe again.
                                </p>
                            </div>
                            <div className="form-grid">
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
                                    <option value="pending">Pending</option>
                                    <option value="blocked">Blocked</option>
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
                            <div className="form-grid">
                                <button className="btn btn-secondary" onClick={() => setSubscriptionModal({ ...subscriptionModal, isOpen: false })}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleManualUpdate}>Save Changes</button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={passwordModal.isOpen}
                onClose={() => setPasswordModal({ ...passwordModal, isOpen: false })}
                title="Reset Admin Password"
            >
                <form onSubmit={handleResetPassword}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        Enter a new password for the primary administrator of this facility.
                    </p>
                    <div className="input-group">
                        <label className="input-label">New Password</label>
                        <PasswordInput
                            required
                            minLength={6}
                            value={passwordModal.newPassword}
                            onChange={e => setPasswordModal({ ...passwordModal, newPassword: e.target.value })}
                            placeholder="Min 6 characters"
                            autoFocus
                        />
                    </div>
                    <div className="form-grid">
                        <button type="button" className="btn btn-secondary" onClick={() => setPasswordModal({ ...passwordModal, isOpen: false })}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Reset Password</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Facilities;
