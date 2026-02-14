import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, X, MapPin, ShieldCheck, Dumbbell, Users } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';

const Gyms = () => {
    const [gyms, setGyms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentGymId, setCurrentGymId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', address: '', adminEmail: '', adminPassword: '', adminName: ''
    });
    const { addToast } = useToast();

    const location = useLocation();
    const navigate = useNavigate();

    const fetchGyms = async () => {
        try {
            const res = await api.get('/gyms');
            setGyms(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchGyms();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '' });
            setShowModal(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '' });
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

    const handleDeleteClick = async (gymId) => {
        if (window.confirm('Are you sure you want to delete this gym? This action cannot be undone.')) {
            try {
                await api.delete(`/gyms/${gymId}`);
                addToast('Gym deleted successfully', 'success');
                fetchGyms();
            } catch (err) {
                addToast('Failed to delete gym', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            alert('Gym name is required');
            return;
        }

        if (!isEditMode) {
            if (!formData.adminEmail || !formData.adminPassword) {
                alert('Please fill in all required fields');
                return;
            }
            if (formData.adminPassword.length < 6) {
                alert('Admin password must be at least 6 characters');
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
            setFormData({ name: '', address: '', adminEmail: '', adminPassword: '', adminName: '' });
            fetchGyms();
        } catch (err) {
            addToast(isEditMode ? 'Failed to update gym' : 'Failed to create gym', 'error');
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
                        overflow: 'visible', // Changed to visible for ActionMenu
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
                            borderTopLeftRadius: 'var(--radius-md)', // Manual radius due to overflow visible
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
                            borderBottomLeftRadius: 'var(--radius-md)',
                            borderBottomRightRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <ShieldCheck size={14} />
                                <span>ID: #{gym.id} • Created: {new Date(gym.createdAt).toLocaleDateString()}</span>
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
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Create Gym'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Gyms;
