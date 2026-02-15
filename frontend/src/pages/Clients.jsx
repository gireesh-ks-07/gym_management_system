import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, User, Phone, Ruler, Weight, Calendar, Mail, Filter, CreditCard, CheckSquare, Square } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AttendanceHistoryModal from '../components/AttendanceHistoryModal';
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
        name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '', aadhaar_number: '', address: ''
    });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDangerous: false
    });

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedClientForPayment, setSelectedClientForPayment] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({});

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedClientHistory, setSelectedClientHistory] = useState({ id: null, name: '' });

    const location = useLocation();
    const navigate = useNavigate();

    const fetchClients = async () => {
        try {
            const [clientsRes, plansRes, attendanceRes] = await Promise.all([
                api.get('/clients'),
                api.get('/plans'),
                api.get('/attendance/today')
            ]);
            setClients(clientsRes.data);
            setPlans(plansRes.data);

            // Create a map of clientId -> true for quick lookup
            const attendance = {};
            attendanceRes.data.forEach(a => {
                attendance[a.clientId] = true;
            });
            setAttendanceMap(attendance);
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
            setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '', aadhaar_number: '', address: '' });
            setShowModal(true);
            // Clear the query parameter so refreshing doesn't re-open it
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '', aadhaar_number: '', address: '' });
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
            planId: client.planId || '',
            aadhaar_number: client.aadhaar_number || '',
            address: client.address || ''
        });
        setShowModal(true);
    };

    const deleteMember = async (clientId) => {
        try {
            await api.delete(`/clients/${clientId}`);
            addToast('Member deleted successfully', 'success');
            fetchClients();
        } catch (err) {
            addToast('Failed to delete member', 'error');
        }
    };

    const handleDeleteClick = (clientId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Member',
            message: 'Are you sure you want to delete this member? This action cannot be undone.',
            onConfirm: () => deleteMember(clientId),
            isDangerous: true,
            confirmText: 'Delete'
        });
    };

    const handlePaymentClick = (clientId) => {
        setSelectedClientForPayment(clientId);
        setShowPaymentModal(true);
    };

    const handleAttendanceClick = async (client) => {
        if (attendanceMap[client.id]) {
            addToast('Member already checked in today', 'info');
            return;
        }

        try {
            await api.post('/attendance', { clientId: client.id, status: 'present' });
            setAttendanceMap(prev => ({ ...prev, [client.id]: true }));
            addToast(`Attendance marked for ${client.name}`, 'success');
        } catch (err) {
            addToast('Failed to mark attendance', 'error');
        }
    };

    const handleHistoryClick = (client) => {
        setSelectedClientHistory({ id: client.id, name: client.name });
        setShowHistoryModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            addToast('Please enter a valid name', 'error');
            return;
        }

        if (!/^\d{10}$/.test(formData.phone)) {
            addToast('Please enter a valid 10-digit phone number', 'error');
            return;
        }

        if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            addToast('Please enter a valid email address', 'error');
            return;
        }

        if (formData.aadhaar_number && !/^\d{12}$/.test(formData.aadhaar_number)) {
            addToast('Aadhaar number must be 12 digits', 'error');
            return;
        }

        if (Number(formData.height) < 0 || Number(formData.weight) < 0) {
            addToast('Height and weight cannot be negative', 'error');
            return;
        }

        try {
            if (isEditMode) {
                await api.put(`/clients/${currentClientId}`, formData);
            } else {
                await api.post('/clients', formData);
            }
            setShowModal(false);
            setFormData({ name: '', email: '', phone: '', height: '', weight: '', joiningDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '', aadhaar_number: '', address: '' });
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
                                onHistory={() => handleHistoryClick(client)}
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <button
                                className={`btn ${attendanceMap[client.id] ? 'btn-success' : 'btn-secondary'}`}
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => handleAttendanceClick(client)}
                                disabled={attendanceMap[client.id]}
                            >
                                {attendanceMap[client.id] ? <CheckSquare size={16} /> : <Square size={16} />}
                                {attendanceMap[client.id] ? 'Present' : 'Mark Present'}
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => handlePaymentClick(client.id)}
                            >
                                <CreditCard size={16} />
                                Pay
                            </button>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</span>
                            <span className={`status-badge ${client.status === 'active' ? 'status-active' :
                                client.status === 'payment_due' ? 'status-payment-due' :
                                    'status-inactive'
                                }`}>
                                {client.status === 'active' ? 'Active' :
                                    client.status === 'payment_due' ? 'Payment Due' :
                                        'Inactive'}
                            </span>
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
                            <input
                                className="input-field"
                                required
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                        <div className="input-group">
                            <label className="input-label">Aadhaar Number (Optional)</label>
                            <input
                                className="input-field"
                                type="text"
                                inputMode="numeric"
                                value={formData.aadhaar_number || ''}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                    setFormData({ ...formData, aadhaar_number: val });
                                }}
                                placeholder="12-digit Aadhaar Number"
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ marginTop: '1rem' }}>
                        <label className="input-label">Address (Optional)</label>
                        <textarea
                            className="input-field"
                            rows="3"
                            value={formData.address || ''}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Full address"
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Add Member'}</button>
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

            <RecordPaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                clients={clients}
                preSelectedClientId={selectedClientForPayment}
                onSuccess={fetchClients}
            />

            <AttendanceHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                clientId={selectedClientHistory.id}
                clientName={selectedClientHistory.name}
            />
        </div>
    );
};

export default Clients;
