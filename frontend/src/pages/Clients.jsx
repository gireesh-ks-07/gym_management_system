import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, User, Phone, Ruler, Weight, Calendar, Mail, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';

const Clients = () => {
    const [clients, setClients] = useState([]);
    const { addToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentClientId, setCurrentClientId] = useState(null);
    const [search, setSearch] = useState('');
    const [plans, setPlans] = useState([]);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: ''
    });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchClients = async () => {
        try {
            const [clientsRes, plansRes] = await Promise.all([
                api.get('/clients'),
                api.get('/plans')
            ]);
            setClients(clientsRes.data);
            setPlans(plansRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'add') {
            setIsEditMode(false);
            setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '' });
            setShowModal(true);
            // Clear the query parameter so refreshing doesn't re-open it
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '' });
        setShowModal(true);
    };

    const handleEditClick = (client) => {
        setIsEditMode(true);
        setCurrentClientId(client.id);
        setFormData({
            name: client.name,
            email: client.email || '',
            phone: client.phone,
            height: client.height,
            weight: client.weight,
            joiningDate: client.joiningDate || new Date().toISOString().split('T')[0],
            gender: client.gender || 'male',
            planId: client.planId || ''
        });
        setShowModal(true);
    };

    const handleDeleteClick = async (clientId) => {
        if (window.confirm('Are you sure you want to delete this member?')) {
            try {
                await api.delete(`/clients/${clientId}`);
                addToast('Member deleted successfully', 'success');
                fetchClients();
            } catch (err) {
                addToast('Failed to delete member', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!/^\d{10}$/.test(formData.phone)) {
            addToast('Please enter a valid 10-digit phone number', 'error');
            return;
        }

        try {
            if (isEditMode) {
                await api.put(`/clients/${currentClientId}`, formData);
            } else {
                await api.post('/clients', formData);
            }
            setShowModal(false);
            setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '' });
            fetchClients();
            addToast(isEditMode ? 'Client updated successfully' : 'Client added successfully', 'success');
        } catch (err) {
            addToast(isEditMode ? 'Failed to update client' : 'Failed to add client', 'error');
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    );

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Members</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage your gym members and their subscriptions</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add Member</span>
                </button>
            </div>

            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0, flex: 1, maxWidth: '400px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input-field"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ paddingLeft: '2.75rem' }}
                        />
                    </div>
                </div>
                <button className="btn btn-secondary">
                    <Filter size={18} />
                    <span>Filter</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {filteredClients.map((client, index) => (
                    <div className="card" key={client.id} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animationDelay: `${index * 0.05}s` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 'bold', fontSize: '1.1rem',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                                }}>
                                    {client.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-highlight)' }}>{client.name}</h3>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Mail size={12} /> {client.email || 'No email'}
                                    </div>
                                </div>
                            </div>
                            <ActionMenu
                                onEdit={() => handleEditClick(client)}
                                onDelete={() => handleDeleteClick(client.id)}
                            />
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Phone size={14} />
                                <span>{client.phone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Calendar size={14} />
                                <span>{new Date(client.joiningDate).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Weight size={14} />
                                <span>{client.weight || '-'} kg</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <Ruler size={14} />
                                <span>{client.height || '-'} cm</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</span>
                            <span className="status-badge status-active">Active Member</span>
                        </div>
                    </div>
                ))}
            </div>

            {filteredClients.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <User size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No members found matching your search.</p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Member' : 'Add New Member'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Full Name</label>
                        <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex. John Doe" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Gender</label>
                            <select className="input-field" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Plan</label>
                            <select className="input-field" value={formData.planId} onChange={e => setFormData({ ...formData, planId: e.target.value })}>
                                <option value="">Select Plan</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Email (Optional)</label>
                            <input className="input-field" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Phone Number</label>
                            <input className="input-field" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 234 567 8900" />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="input-label">Height (cm)</label>
                            <input className="input-field" type="number" value={formData.height} onChange={e => setFormData({ ...formData, height: e.target.value })} placeholder="175" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Weight (kg)</label>
                            <input className="input-field" type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} placeholder="70" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Joined Date</label>
                            <input className="input-field" type="date" value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Add Member'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Clients;
