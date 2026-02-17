import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import {
    Plus, Search, Edit2, Trash2, Layers, Check, X,
    ArrowRight, Settings, Activity, Dumbbell, Music, Sword, Heart
} from 'lucide-react';
import Modal from '../components/Modal';
import { toTitleCase } from '../utils/textCase';

const FacilityTypes = () => {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentTypeId, setCurrentTypeId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        icon: 'Activity',
        memberFormConfig: []
    });

    const { addToast, showConfirm } = useToast();

    const icons = [
        { name: 'Activity', icon: <Activity size={18} /> },
        { name: 'Dumbbell', icon: <Dumbbell size={18} /> },
        { name: 'Music', icon: <Music size={18} /> },
        { name: 'Sword', icon: <Sword size={18} /> },
        { name: 'Heart', icon: <Heart size={18} /> },
        { name: 'Layers', icon: <Layers size={18} /> }
    ];

    const fetchTypes = async () => {
        try {
            const res = await api.get('/api/facility-types');
            setTypes(res.data);
        } catch (err) {
            addToast('Failed to fetch facility types', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await api.put(`/api/facility-types/${currentTypeId}`, formData);
                addToast('Facility type updated successfully', 'success');
            } else {
                await api.post('/api/facility-types', formData);
                addToast('Facility type created successfully', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchTypes();
        } catch (err) {
            addToast(err.response?.data?.message || 'Action failed', 'error');
        }
    };

    const resetForm = () => {
        setFormData({ name: '', icon: 'Activity', memberFormConfig: [] });
        setIsEditMode(false);
        setCurrentTypeId(null);
    };

    const handleEdit = (type) => {
        setFormData({
            name: type.name,
            icon: type.icon || 'Activity',
            memberFormConfig: type.memberFormConfig || []
        });
        setIsEditMode(true);
        setCurrentTypeId(type.id);
        setShowModal(true);
    };

    const handleDelete = (id) => {
        showConfirm(
            'Are you sure you want to delete this facility type? This action cannot be undone.',
            async () => {
                try {
                    await api.delete(`/api/facility-types/${id}`);
                    addToast('Facility type deleted successfully', 'success');
                    fetchTypes();
                } catch (err) {
                    console.error('Delete error:', err);
                    addToast(err.response?.data?.message || 'Failed to delete facility type', 'error');
                }
            },
            'Delete Facility Type'
        );
    };

    const addField = () => {
        setFormData({
            ...formData,
            memberFormConfig: [
                ...formData.memberFormConfig,
                { label: '', name: '', type: 'text', required: false }
            ]
        });
    };

    const removeField = (index) => {
        const newConfig = [...formData.memberFormConfig];
        newConfig.splice(index, 1);
        setFormData({ ...formData, memberFormConfig: newConfig });
    };

    const updateField = (index, field, value) => {
        const newConfig = [...formData.memberFormConfig];
        newConfig[index][field] = field === 'label' ? toTitleCase(value) : value;
        // Auto-generate name from label if name is empty
        if (field === 'label' && !newConfig[index].name) {
            newConfig[index].name = value.toLowerCase().replace(/\s+/g, '_');
        }
        setFormData({ ...formData, memberFormConfig: newConfig });
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Facility Types</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Define facility categories and custom member registration forms.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { resetForm(); setShowModal(true); }}
                >
                    <Plus size={18} />
                    <span>Create Type</span>
                </button>
            </div>

            {loading ? (
                <div className="loader-container">
                    <div className="loader-icon"></div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {types.map((type, index) => (
                        <div key={type.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animationDelay: `${index * 0.05}s` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: 'var(--primary-glow)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
                                }}>
                                    {icons.find(i => i.name === type.icon)?.icon || <Activity size={24} />}
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button className="icon-btn" onClick={() => handleEdit(type)} style={{ color: 'var(--primary)' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="icon-btn" onClick={() => handleDelete(type.id)} style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-highlight)' }}>{type.name}</h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {type.memberFormConfig?.length || 0} Custom Fields Defined
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Form Fields</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <span className="badge-pill">Name</span>
                                    <span className="badge-pill">Phone</span>
                                    <span className="badge-pill">Email</span>
                                    {type.memberFormConfig?.map((field, idx) => (
                                        <span key={idx} className="badge-pill active">{field.label}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}

                    {types.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                            <Layers size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                            <p>No facility types defined yet. Create one to get started.</p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditMode ? 'Edit Facility Type' : 'Create Facility Type'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Type Name</label>
                        <input
                            className="input-field"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: toTitleCase(e.target.value) })}
                            placeholder="e.g. Yoga Studio, Dance Academy"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Select Icon</label>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {icons.map(item => (
                                <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon: item.name })}
                                    style={{
                                        width: '45px',
                                        height: '45px',
                                        borderRadius: '10px',
                                        border: `2px solid ${formData.icon === item.name ? 'var(--primary)' : 'var(--border-color)'}`,
                                        background: formData.icon === item.name ? 'var(--primary-glow)' : 'transparent',
                                        color: formData.icon === item.name ? 'var(--primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {item.icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <label className="input-label" style={{ marginBottom: 0 }}>Extra Member Fields</label>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={addField}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            >
                                <Plus size={14} /> Add Field
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {formData.memberFormConfig.map((field, index) => (
                                <div key={index} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <input
                                            className="input-field"
                                            placeholder="Label (e.g. Age)"
                                            value={field.label}
                                            onChange={e => updateField(index, 'label', e.target.value)}
                                            required
                                            style={{ flex: 1 }}
                                        />
                                        <select
                                            className="input-field"
                                            value={field.type}
                                            onChange={e => updateField(index, 'type', e.target.value)}
                                            style={{ width: '130px' }}
                                        >
                                            <option value="text">Single Line</option>
                                            <option value="textarea">Multiline Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="checkbox">Toggle</option>
                                        </select>
                                        <button type="button" onClick={() => removeField(index)} style={{ color: 'var(--danger)', padding: '0.5rem' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={e => updateField(index, 'required', e.target.checked)}
                                            id={`req-${index}`}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label htmlFor={`req-${index}`} style={{ cursor: 'pointer' }}>Mark as Required</label>
                                        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>ID: {field.name}</span>
                                    </div>
                                </div>
                            ))}

                            {formData.memberFormConfig.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    No extra fields. Only standard member fields will be shown.
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>{isEditMode ? 'Update Type' : 'Create Type'}</button>
                    </div>
                </form>
            </Modal>

            <style>{`
                .badge-pill {
                    padding: 0.35rem 0.75rem;
                    border-radius: 99px;
                    border: 1px solid var(--border-color);
                    background: rgba(255,255,255,0.03);
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                .badge-pill.active {
                    background: var(--primary-glow);
                    color: var(--primary);
                    border-color: rgba(34, 197, 94, 0.2);
                }
            `}</style>
        </div>
    );
};

export default FacilityTypes;
