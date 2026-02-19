import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, User, Phone, Ruler, Weight, Calendar, Mail, Filter, CreditCard, CheckSquare, Square } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ActionMenu from '../components/ActionMenu';
import Modal from '../components/Modal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import AttendanceHistoryModal from '../components/AttendanceHistoryModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';
import { toTitleCase } from '../utils/textCase';

const Clients = () => {
    const [clients, setClients] = useState([]);
    const { addToast, showConfirm } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentClientId, setCurrentClientId] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [planFilter, setPlanFilter] = useState('all');
    const [plans, setPlans] = useState([]);
    const [facility, setFacility] = useState(null);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', joiningDate: new Date().toISOString().split('T')[0], billingRenewalDate: new Date().toISOString().split('T')[0], gender: 'male', planId: '', address: '', customFields: {}
    });

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedClientForPayment, setSelectedClientForPayment] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({});

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedClientHistory, setSelectedClientHistory] = useState({ id: null, name: '' });
    const isTitleCaseCustomType = (type) => ['text', 'textarea'].includes(type);

    const location = useLocation();
    const navigate = useNavigate();
    const triggerDashboardRefresh = () => window.dispatchEvent(new Event('dashboard:refresh'));

    const fetchClients = async () => {
        try {
            const [clientsRes, plansRes, attendanceRes] = await Promise.all([
                api.get('/clients'),
                api.get('/plans'),
                api.get('/attendance/today')
            ]);
            setClients(clientsRes.data);
            setPlans(plansRes.data);

            // Fetch facility config for custom fields
            try {
                const facRes = await api.get('/api/facility/subscription');
                setFacility(facRes.data);
            } catch (facErr) {
                console.log('Not a facility user or failed to fetch facility config');
            }

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
        const action = queryParams.get('action');
        const status = queryParams.get('status');

        if (action === 'add') {
            handleAddClick();
            navigate(location.pathname, { replace: true });
        }

        if (status) {
            setStatusFilter(status);
        }
    }, [location, navigate]);

    const handleAddClick = () => {
        const memberLimit = facility?.SubscriptionPlan?.maxMembers ?? facility?.subscriptionPlan?.maxMembers ?? null;
        if (memberLimit !== null && clients.length >= Number(memberLimit)) {
            addToast(`Exceeded limit: only ${memberLimit} members allowed in current SaaS plan.`, 'error');
            return;
        }

        setIsEditMode(false);
        const today = new Date().toISOString().split('T')[0];
        setFormData({ name: '', email: '', phone: '', joiningDate: today, billingRenewalDate: today, gender: 'male', planId: '', address: '', customFields: {} });
        setShowModal(true);
    };

    const handleEditClick = (client) => {
        setIsEditMode(true);
        setCurrentClientId(client.id);
        setFormData({
            name: client.name,
            email: client.email || '',
            phone: client.phone,
            joiningDate: client.joiningDate || new Date().toISOString().split('T')[0],
            billingRenewalDate: client.billingRenewalDate || client.joiningDate || new Date().toISOString().split('T')[0],
            gender: client.gender || 'male',
            planId: client.planId || '',
            address: client.address || '',
            customFields: client.customFields || {}
        });
        setShowModal(true);
    };

    const deleteMember = async (clientId) => {
        try {
            await api.delete(`/clients/${clientId}`);
            addToast('Member deleted successfully', 'success');
            fetchClients();
            triggerDashboardRefresh();
        } catch (err) {
            addToast('Failed to delete member', 'error');
        }
    };

    const handleDeleteClick = (clientId) => {
        showConfirm(
            'Are you sure you want to delete this member? This action cannot be undone.',
            () => deleteMember(clientId),
            'Delete Member'
        );
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



        try {
            if (isEditMode) {
                await api.put(`/clients/${currentClientId}`, formData);
            } else {
                await api.post('/clients', formData);
            }
            setShowModal(false);
            const today = new Date().toISOString().split('T')[0];
            setFormData({ name: '', email: '', phone: '', joiningDate: today, billingRenewalDate: today, gender: 'male', planId: '', address: '', customFields: {} });
            fetchClients();
            triggerDashboardRefresh();
            addToast(isEditMode ? 'Client updated successfully' : 'Client added successfully', 'success');
        } catch (err) {
            const message = err?.response?.data?.message;
            addToast(message || (isEditMode ? 'Failed to update client' : 'Failed to add client'), 'error');
        }
    };

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        // Check for loose equality because select value is string and planId might be number
        const matchesPlan = planFilter === 'all' || c.planId == planFilter;

        return matchesSearch && matchesStatus && matchesPlan;
    });

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Members</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage your members and their subscriptions</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={18} />
                    <span>Add Member</span>
                </button>
            </div>

            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
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

                    {/* Plan Filter Dropdown */}
                    <div style={{ minWidth: '200px' }}>
                        <select
                            className="input-field"
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value)}
                            style={{ height: '100%', cursor: 'pointer' }}
                        >
                            <option value="all">All Plans</option>
                            {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Status Filter Chips */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['all', 'active', 'payment_due', 'inactive'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                border: `1px solid ${statusFilter === status ? 'var(--primary)' : 'var(--border-color)'}`,
                                background: statusFilter === status ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                color: statusFilter === status ? 'var(--primary)' : 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                fontWeight: statusFilter === status ? '600' : '400',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'capitalize'
                            }}
                        >
                            {status === 'all' ? 'All Members' : status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
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
                                <span>{formatDate(client.joiningDate)}</span>
                            </div>
                            {client.customFields && Object.entries(client.customFields).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <CheckSquare size={14} />
                                    <span>{String(value)}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <button
                                className={`btn ${attendanceMap[client.id] ? 'btn-success' : 'btn-secondary'}`}
                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => handleAttendanceClick(client)}
                                disabled={attendanceMap[client.id]}
                            >
                                {attendanceMap[client.id] ? <CheckSquare size={16} /> : <Square size={16} />}
                                {attendanceMap[client.id] ? 'Checked' : 'Check-in'}
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

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Member' : 'Add New Member'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-grid-2-1">
                        <div className="input-group">
                            <label className="input-label">Full Name</label>
                            <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })} placeholder="Ex. John Doe" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Gender</label>
                            <select className="input-field" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="input-group">
                            <label className="input-label">Plan</label>
                            <select className="input-field" value={formData.planId} onChange={e => setFormData({ ...formData, planId: e.target.value })}>
                                <option value="">Select Plan</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
                                ))}
                            </select>
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

                    <div className="form-grid">
                        <div className="input-group">
                            <label className="input-label">Email (Optional)</label>
                            <input className="input-field" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Joined Date</label>
                            <input
                                className="input-field"
                                type="date"
                                value={formData.joiningDate}
                                onChange={e => {
                                    const nextJoiningDate = e.target.value;
                                    const shouldSyncBilling = !formData.billingRenewalDate || formData.billingRenewalDate === formData.joiningDate;
                                    setFormData({
                                        ...formData,
                                        joiningDate: nextJoiningDate,
                                        billingRenewalDate: shouldSyncBilling ? nextJoiningDate : formData.billingRenewalDate
                                    });
                                }}
                            />
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="input-group">
                            <label className="input-label">Billing Renewal Date</label>
                            <input
                                className="input-field"
                                type="date"
                                value={formData.billingRenewalDate || ''}
                                onChange={e => setFormData({ ...formData, billingRenewalDate: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Next Expiry (Auto)</label>
                            <input className="input-field" value="Calculated from Billing Date + Plan" readOnly />
                        </div>
                    </div>



                    <div className="input-group" style={{ marginTop: '1rem' }}>
                        <label className="input-label">Address (Optional)</label>
                            <textarea
                                className="input-field"
                                rows="2"
                                value={formData.address || ''}
                                onChange={e => setFormData({ ...formData, address: toTitleCase(e.target.value) })}
                                placeholder="Full address"
                                style={{ resize: 'vertical' }}
                            />
                    </div>

                    {facility?.FacilityType?.memberFormConfig && facility.FacilityType.memberFormConfig.length > 0 && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: '600' }}>Additional Information</h3>
                            <div className="form-grid">
                                {facility.FacilityType.memberFormConfig.map(field => (
                                    <div
                                        className={`input-group ${field.type === 'textarea' ? 'form-grid-full' : ''}`}
                                        key={field.name}
                                        style={{
                                            marginBottom: 0,
                                            display: 'flex', flexDirection: 'column'
                                        }}
                                    ><label className="input-label">{field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                                        {field.type === 'checkbox' ? (
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', height: '42px' }}
                                                onClick={() => setFormData({ ...formData, customFields: { ...formData.customFields, [field.name]: !formData.customFields[field.name] } })}
                                            >
                                                {formData.customFields[field.name] ? <CheckSquare color="var(--primary)" size={18} /> : <Square color="var(--text-secondary)" size={18} />}
                                                <span style={{ fontSize: '0.9rem', color: formData.customFields[field.name] ? 'var(--text-main)' : 'var(--text-secondary)' }}>{field.label}</span>
                                            </div>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                className="input-field"
                                                required={field.required}
                                                rows="3"
                                                value={formData.customFields[field.name] || ''}
                                                onChange={e => setFormData({ ...formData, customFields: { ...formData.customFields, [field.name]: toTitleCase(e.target.value) } })}
                                                placeholder={field.label}
                                                style={{ resize: 'vertical' }}
                                            />
                                        ) : (
                                            <input
                                                type={field.type}
                                                className="input-field"
                                                required={field.required}
                                                value={formData.customFields[field.name] || ''}
                                                onChange={e => {
                                                    const raw = e.target.value;
                                                    const normalized = isTitleCaseCustomType(field.type) ? toTitleCase(raw) : raw;
                                                    setFormData({ ...formData, customFields: { ...formData.customFields, [field.name]: normalized } });
                                                }}
                                                placeholder={field.label}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="form-grid">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{isEditMode ? 'Save Changes' : 'Add Member'}</button>
                    </div>
                </form>
            </Modal>

            <RecordPaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                clients={clients}
                preSelectedClientId={selectedClientForPayment}
                onSuccess={() => {
                    fetchClients();
                    triggerDashboardRefresh();
                }}
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
