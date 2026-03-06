import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, UserCog, Mail, Calendar, Shield, Phone } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import PasswordInput from '../components/PasswordInput';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';
import { toTitleCase } from '../utils/textCase';

const Staff = () => {
    const [staff, setStaff] = useState([]);
    const [facility, setFacility] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentStaffId, setCurrentStaffId] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff', phone: '' });
    const { addToast, showConfirm } = useToast();

    const location = useLocation();
    const navigate = useNavigate();
    const triggerDashboardRefresh = () => window.dispatchEvent(new Event('dashboard:refresh'));

    const fetchStaff = async () => {
        try {
            const [staffRes, facilityRes] = await Promise.all([
                api.get('/staff'),
                api.get('/facility/subscription').catch(() => null),
            ]);
            setStaff(staffRes.data);
            setFacility(facilityRes?.data || null);
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch staff list', 'error');
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            handleAddClick();
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        const staffLimit = facility?.SubscriptionPlan?.maxStaff ?? facility?.subscriptionPlan?.maxStaff ?? null;
        if (staffLimit !== null && staff.length >= Number(staffLimit)) {
            addToast(`Exceeded limit: only ${staffLimit} staff allowed in current SaaS plan.`, 'error');
            return;
        }

        setIsEditMode(false);
        setFormData({ name: '', email: '', password: '', role: 'staff', phone: '' });
        setShowModal(true);
    };

    const handleEditClick = (s) => {
        setIsEditMode(true);
        setCurrentStaffId(s.id);
        setFormData({ name: s.name, email: s.email, password: '', role: 'staff', phone: s.phone || '' });
        setShowModal(true);
    };

    const deleteStaff = async (staffId) => {
        try {
            await api.delete(`/staff/${staffId}`);
            addToast('Staff member deleted successfully', 'success');
            fetchStaff();
            triggerDashboardRefresh();
        } catch (err) {
            addToast('Failed to delete staff member', 'error');
        }
    };

    const handleDeleteClick = (staffId) => {
        showConfirm(
            'Are you sure you want to delete this staff member? This action cannot be undone.',
            () => deleteStaff(staffId),
            'Delete Staff Member'
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            addToast('Please enter a valid name', 'error');
            return;
        }

        if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            addToast('Please enter a valid e-mail address', 'error');
            return;
        }

        if (formData.phone && formData.phone.length !== 10) {
            addToast('Phone number must be 10 digits', 'error');
            return;
        }

        if (!isEditMode && formData.password.length < 6) {
            addToast('Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            if (isEditMode) {
                await api.put(`/staff/${currentStaffId}`, { name: formData.name, email: formData.email, phone: formData.phone });
                addToast('Staff updated successfully', 'success');
            } else {
                await api.post('/staff', formData);
                addToast('Staff added successfully', 'success');
            }
            setShowModal(false);
            setFormData({ name: '', email: '', password: '', role: 'staff', phone: '' });
            fetchStaff();
            triggerDashboardRefresh();
        } catch (err) {
            const message = err?.response?.data?.message;
            addToast(message || (isEditMode ? 'Failed to update staff' : 'Failed to add staff'), 'error');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Staff Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage staff and facility administrators</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add Staff</span>
                </button>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: '16px' }}>
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Staff Member</th>
                                <th>Contact Details</th>
                                <th>Access Role</th>
                                <th>Member Since</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((s, index) => (
                                <tr key={s.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                    <td style={{ paddingLeft: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '14px',
                                                background: 'var(--primary-glow)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--primary)',
                                                fontWeight: 'bold',
                                                fontSize: '1.1rem'
                                            }}>
                                                {s.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700', color: 'var(--text-highlight)', fontSize: '1rem' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>#{s.id.toString().padStart(4, '0')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: '500' }}>
                                            <Mail size={14} color="var(--primary)" />
                                            {s.email}
                                        </div>
                                        {s.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                <Phone size={14} color="var(--primary)" />
                                                {s.phone}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="status-badge" style={{
                                            background: 'var(--bg-body)',
                                            color: 'var(--text-main)',
                                            borderColor: 'var(--border-color)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            fontSize: '0.8rem'
                                        }}>
                                            <Shield size={12} color="var(--primary)" />
                                            {s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'Staff'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
                                            {formatDate(s.createdAt)}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="status-badge status-active" style={{ padding: '4px 12px', borderRadius: '8px' }}>Active</span>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <ActionMenu
                                                onEdit={() => handleEditClick(s)}
                                                onDelete={() => handleDeleteClick(s.id)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {staff.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <UserCog size={48} style={{ opacity: 0.1 }} />
                                            <p>No staff members found. Add your first staff member!</p>
                                        </div>
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
                title={isEditMode ? 'Edit Staff Details' : 'Add New Staff'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Full Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })} placeholder="Ex. Sarah Smith" />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Email Address</label>
                        <input className="input-field" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="sarah@example.com" />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Phone Number (Optional)</label>
                        <input
                            className="input-field"
                            type="text"
                            inputMode="numeric"
                            value={formData.phone}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setFormData({ ...formData, phone: val });
                            }}
                            placeholder="9876543210"
                        />
                    </div>
                    {!isEditMode && (
                        <div className="input-group">
                            <label className="input-label">Temporary Password</label>
                            <PasswordInput
                                required
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Update Staff' : 'Add Staff'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Staff;
