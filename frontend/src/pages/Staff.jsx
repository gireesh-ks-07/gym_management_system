import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, UserCog, Mail, Calendar, Shield, Phone } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Staff = () => {
    const [staff, setStaff] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentStaffId, setCurrentStaffId] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'trainer', phone: '' });
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

    const fetchStaff = async () => {
        try {
            const res = await api.get('/staff');
            setStaff(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', email: '', password: '', role: 'trainer', phone: '' });
            setShowModal(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', email: '', password: '', role: 'trainer', phone: '' });
        setShowModal(true);
    };

    const handleEditClick = (s) => {
        setIsEditMode(true);
        setCurrentStaffId(s.id);
        setFormData({ name: s.name, email: s.email, password: '', role: 'trainer', phone: s.phone || '' });
        setShowModal(true);
    };

    const deleteStaff = async (staffId) => {
        try {
            await api.delete(`/staff/${staffId}`);
            addToast('Staff member deleted successfully', 'success');
            fetchStaff();
        } catch (err) {
            addToast('Failed to delete staff member', 'error');
        }
    };

    const handleDeleteClick = (staffId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Staff Member',
            message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
            onConfirm: () => deleteStaff(staffId),
            isDangerous: true,
            confirmText: 'Delete'
        });
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
            setFormData({ name: '', email: '', password: '', role: 'trainer', phone: '' });
            fetchStaff();
        } catch (err) {
            addToast(isEditMode ? 'Failed to update staff' : 'Failed to add staff', 'error');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Staff Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage trainers and gym administrators</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add Staff</span>
                </button>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'visible' }}>
                <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'visible', minHeight: '300px' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Staff Member</th>
                                <th>Contact Email</th>
                                <th>Role</th>
                                <th>Date Joined</th>
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
                                                width: '40px', height: '40px', borderRadius: '12px',
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--accent-blue)'
                                            }}>
                                                <UserCog size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{s.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <Mail size={14} />
                                            {s.email}
                                        </div>
                                        {s.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                                <Phone size={14} />
                                                {s.phone}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="status-badge" style={{
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            color: '#a78bfa',
                                            borderColor: 'rgba(139, 92, 246, 0.2)'
                                        }}>
                                            <Shield size={12} style={{ marginRight: '4px' }} />
                                            {s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'Staff'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            <Calendar size={14} />
                                            {new Date(s.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="status-badge status-active">Active</span>
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
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                        No staff members found. Add your first trainer!
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
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex. Sarah Smith" />
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
                            <input className="input-field" type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Update Staff' : 'Add Staff'}</button>
                    </div>
                </form>
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
        </div >
    );
};

export default Staff;
