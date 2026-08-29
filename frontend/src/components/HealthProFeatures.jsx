import React, { useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2, Activity, Target, Trophy, Stethoscope, Pill } from 'lucide-react';
import { formatDate } from '../utils/date';
import Modal from './Modal';

const emptyForms = {
    metrics: () => ({ date: new Date().toISOString().split('T')[0], bodyFatPercentage: '', muscleMass: '', weight: '', arms: '', chest: '', waist: '', legs: '', calves: '' }),
    prs: () => ({ date: new Date().toISOString().split('T')[0], exercise: '', weight: '', reps: '', notes: '' }),
    tests: () => ({ date: new Date().toISOString().split('T')[0], testName: '', score: '', notes: '' }),
    mobility: () => ({ date: new Date().toISOString().split('T')[0], joint: '', status: 'Good', notes: '' }),
    reviews: () => ({ date: new Date().toISOString().split('T')[0], progressRating: 5, notes: '', nextSteps: '' }),
    supplements: () => ({ type: '', name: '', dosage: '' })
};

const modalTitles = {
    metrics: 'Add Body Metrics',
    prs: 'Add Personal Record',
    tests: 'Add Fitness Test',
    mobility: 'Add Mobility Test',
    reviews: 'Add Goal Review',
    supplements: 'Add Supplement'
};

// A compact panel (styled like Body Metrics) with a header + Add button.
const Panel = ({ icon: Icon, title, color, onAdd, children }) => (
    <div className="glass-panel">
        <div className="section-header">
            <div className="section-title"><Icon size={18} color={color} /> {title}</div>
            <button className="btn btn-ghost" style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.8rem' }} onClick={onAdd}>
                <Plus size={15} /> Add
            </button>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '260px', overflowY: 'auto' }}>
            {children}
        </div>
    </div>
);

// A single compact list row inside a panel (plain div — not .metric-card,
// which is a centered vertical stat style that breaks the horizontal layout).
const Row = ({ primary, secondary, value, valueColor, onDelete }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</div>
            {secondary && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {value != null && value !== '' && <div style={{ fontWeight: 700, color: valueColor || 'var(--text-highlight)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{value}</div>}
            {onDelete && <button className="icon-btn" title="Remove" onClick={onDelete} style={{ color: '#ef4444', padding: '2px' }}><Trash2 size={15} /></button>}
        </div>
    </div>
);

const Empty = ({ text }) => (
    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{text}</div>
);

const ALL_SECTIONS = ['metrics', 'prs', 'tests', 'mobility', 'reviews', 'supplements'];

const HealthProFeatures = ({ profile, clientId, fetchData, sections = ALL_SECTIONS }) => {
    const { addToast } = useToast();
    const [activeModal, setActiveModal] = useState(null); // section id or null
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);

    const openModal = (section) => { setForm(emptyForms[section]()); setActiveModal(section); };
    const closeModal = () => { setActiveModal(null); };
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    // Per-section submit — returns the request payload/endpoint.
    const submitters = {
        metrics: () => {
            const reqs = [];
            if (form.weight || form.bodyFatPercentage || form.muscleMass) {
                reqs.push({ url: `/clients/${clientId}/health-profile/body-composition`, body: { date: form.date, weight: form.weight, bodyFat: form.bodyFatPercentage, notes: `Muscle Mass: ${form.muscleMass || 0}kg` } });
            }
            if (form.arms || form.chest || form.waist || form.legs || form.calves) {
                reqs.push({ url: `/clients/${clientId}/health-profile/measurements`, body: { date: form.date, arms: form.arms, chest: form.chest, waist: form.waist, thighs: form.legs, notes: `Calves: ${form.calves || 0}` } });
            }
            if (reqs.length === 0) reqs.push({ url: `/clients/${clientId}/health-profile/body-composition`, body: { date: form.date } });
            return reqs;
        },
        prs: () => ({ url: `/clients/${clientId}/health-profile/personal-records`, body: form }),
        tests: () => ({ url: `/clients/${clientId}/health-profile/fitness-tests`, body: { date: form.date, label: form.testName, score: form.score, notes: form.notes } }),
        mobility: () => ({ url: `/clients/${clientId}/health-profile/mobility-screenings`, body: { date: form.date, areas: [{ name: form.joint, status: form.status }], notes: form.notes } }),
        reviews: () => ({ url: `/clients/${clientId}/health-profile/goal-reviews`, body: { date: form.date, progressRating: form.progressRating, notes: form.notes + (form.nextSteps ? `\nNext Steps: ${form.nextSteps}` : '') } }),
        supplements: () => ({ url: `/clients/${clientId}/health-profile/supplements`, body: form })
    };

    const handleSave = async () => {
        if (!form.date && activeModal !== 'supplements') {
            return addToast('Date is required', 'error');
        }
        if (activeModal === 'supplements' && !form.name?.trim()) {
            return addToast('Supplement name is required', 'error');
        }
        if (activeModal === 'prs' && (!form.exercise?.trim() || !form.weight || !form.reps)) {
            return addToast('Exercise, weight, and reps are required', 'error');
        }
        if (activeModal === 'tests' && (!form.testName?.trim() || !form.score?.trim())) {
            return addToast('Test name and score are required', 'error');
        }
        if (activeModal === 'mobility' && !form.joint?.trim()) {
            return addToast('Joint/Area is required', 'error');
        }
        if (activeModal === 'metrics' && !form.weight && !form.bodyFatPercentage && !form.muscleMass && !form.arms && !form.chest && !form.waist && !form.legs && !form.calves) {
            return addToast('Please enter at least one metric', 'error');
        }
        
        setSaving(true);
        try {
            const reqs = submitters[activeModal]();
            if (Array.isArray(reqs)) {
                await Promise.all(reqs.map(r => api.post(r.url, r.body)));
            } else {
                await api.post(reqs.url, reqs.body);
            }
            addToast('Saved', 'success');
            closeModal();
            fetchData();
        } catch (e) {
            addToast(e.response?.data?.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteSupplement = async (id) => {
        try {
            await api.delete(`/clients/${clientId}/health-profile/supplements/${id}`);
            addToast('Supplement removed', 'success');
            fetchData();
        } catch (e) {
            addToast('Failed to remove supplement', 'error');
        }
    };

    const statusColor = (s) => (s === 'Excellent' || s === 'Good') ? '#10b981' : s === 'Fair' ? '#f59e0b' : '#ef4444';

    const has = (id) => sections.includes(id);

    return (
        <>
            {has('metrics') && (
            <Panel icon={Activity} title="Body Metrics" color="#10b981" onAdd={() => openModal('metrics')}>
                {(() => {
                    const logs = [];
                    (profile.bodyCompositionHistory || []).forEach(l => logs.push({ ...l, _type: 'comp' }));
                    (profile.measurementLogs || []).forEach(l => logs.push({ ...l, _type: 'meas' }));
                    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
                    if (logs.length === 0) return <Empty text="No metrics logged yet." />;
                    return logs.map((log, i) => {
                        if (log._type === 'comp') {
                            return <Row key={`c${i}`} primary={`${log.weight || '--'} kg`} secondary={formatDate(log.date)} value={`${log.bodyFat || '--'}% BF`} valueColor="#10b981" />;
                        } else {
                            return <Row key={`m${i}`} primary={formatDate(log.date)} secondary={`Arms ${log.arms || '-'} · Chest ${log.chest || '-'} · Waist ${log.waist || '-'} · Legs ${log.thighs || '-'}`} valueColor="#3b82f6" />;
                        }
                    });
                })()}
            </Panel>)}

            {has('prs') && (
            <Panel icon={Trophy} title="Personal Records" color="#f59e0b" onAdd={() => openModal('prs')}>
                {(profile.personalRecords || []).length === 0
                    ? <Empty text="No PRs yet. Let's break some records!" />
                    : profile.personalRecords.map((log, i) => (
                        <Row key={i} primary={log.exercise} secondary={formatDate(log.date)}
                            value={`${log.weight}kg × ${log.reps}`} valueColor="#f59e0b" />
                    ))}
            </Panel>)}

            {has('tests') && (
            <Panel icon={Activity} title="Fitness Tests" color="#8b5cf6" onAdd={() => openModal('tests')}>
                {(profile.fitnessTests || []).length === 0
                    ? <Empty text="No tests logged yet." />
                    : profile.fitnessTests.map((log, i) => (
                        <Row key={i} primary={log.label || log.type} secondary={log.notes || formatDate(log.date)}
                            value={log.score} valueColor="#8b5cf6" />
                    ))}
            </Panel>)}

            {has('mobility') && (
            <Panel icon={Stethoscope} title="Mobility Test" color="#06b6d4" onAdd={() => openModal('mobility')}>
                {(profile.mobilityScreenings || []).length === 0
                    ? <Empty text="No mobility screenings yet." />
                    : profile.mobilityScreenings.map((log, i) => {
                        const area = log.areas && log.areas[0] ? log.areas[0] : { name: '--', status: '--' };
                        return <Row key={i} primary={area.name} secondary={formatDate(log.date)}
                            value={area.status} valueColor={statusColor(area.status)} />;
                    })}
            </Panel>)}

            {has('reviews') && (
            <Panel icon={Target} title="Goal Reviews" color="#ec4899" onAdd={() => openModal('reviews')}>
                {(profile.goalReviews || []).length === 0
                    ? <Empty text="No goal reviews yet." />
                    : profile.goalReviews.map((log, i) => (
                        <Row key={i} primary={formatDate(log.reviewDate || log.date)} secondary={log.notes}
                            value={`${log.progressRating}/10`} valueColor="#ec4899" />
                    ))}
            </Panel>)}

            {has('supplements') && (
            <Panel icon={Pill} title="Supplements" color="#22c55e" onAdd={() => openModal('supplements')}>
                {(profile.supplements || []).length === 0
                    ? <Empty text="No supplements added yet." />
                    : profile.supplements.map((s) => (
                        <Row key={s.id}
                            primary={<span>{s.type && <span className="status-badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', marginRight: 8 }}>{s.type}</span>}{s.name}</span>}
                            secondary={s.dosage || null}
                            onDelete={() => deleteSupplement(s.id)} />
                    ))}
            </Panel>)}

            {/* Shared Add Modal — content switches by section */}
            <Modal isOpen={!!activeModal} onClose={closeModal} title={modalTitles[activeModal] || 'Add'}>
                {activeModal === 'metrics' && (
                    <div className="form-grid">
                        <div className="input-group form-grid-full"><label className="input-label">Date</label><input type="date" className="input-field" value={form.date} onChange={e => set({ date: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Weight (kg)</label><input type="number" className="input-field" value={form.weight} onChange={e => set({ weight: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Body Fat %</label><input type="number" className="input-field" value={form.bodyFatPercentage} onChange={e => set({ bodyFatPercentage: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Muscle Mass (kg)</label><input type="number" className="input-field" value={form.muscleMass} onChange={e => set({ muscleMass: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Chest (cm)</label><input type="number" className="input-field" value={form.chest} onChange={e => set({ chest: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Waist (cm)</label><input type="number" className="input-field" value={form.waist} onChange={e => set({ waist: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Arms (cm)</label><input type="number" className="input-field" value={form.arms} onChange={e => set({ arms: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Legs (cm)</label><input type="number" className="input-field" value={form.legs} onChange={e => set({ legs: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Calves (cm)</label><input type="number" className="input-field" value={form.calves} onChange={e => set({ calves: e.target.value })} /></div>
                    </div>
                )}
                {activeModal === 'prs' && (
                    <div className="form-grid">
                        <div className="input-group"><label className="input-label">Date</label><input type="date" className="input-field" value={form.date} onChange={e => set({ date: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Exercise</label><input type="text" className="input-field" placeholder="e.g. Deadlift" value={form.exercise} onChange={e => set({ exercise: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Weight (kg)</label><input type="number" className="input-field" value={form.weight} onChange={e => set({ weight: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Reps</label><input type="number" className="input-field" value={form.reps} onChange={e => set({ reps: e.target.value })} /></div>
                    </div>
                )}
                {activeModal === 'tests' && (
                    <div className="form-grid">
                        <div className="input-group"><label className="input-label">Date</label><input type="date" className="input-field" value={form.date} onChange={e => set({ date: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Test Name</label><input type="text" className="input-field" placeholder="e.g. 1 Mile Run" value={form.testName} onChange={e => set({ testName: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Score/Time</label><input type="text" className="input-field" placeholder="e.g. 6:30" value={form.score} onChange={e => set({ score: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Notes</label><input type="text" className="input-field" value={form.notes} onChange={e => set({ notes: e.target.value })} /></div>
                    </div>
                )}
                {activeModal === 'mobility' && (
                    <div className="form-grid">
                        <div className="input-group"><label className="input-label">Date</label><input type="date" className="input-field" value={form.date} onChange={e => set({ date: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Joint/Area</label><input type="text" className="input-field" placeholder="e.g. Shoulders" value={form.joint} onChange={e => set({ joint: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Status</label>
                            <select className="input-field" value={form.status} onChange={e => set({ status: e.target.value })}>
                                <option value="Excellent">Excellent</option>
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Poor">Poor</option>
                                <option value="Restricted">Restricted</option>
                            </select>
                        </div>
                        <div className="input-group"><label className="input-label">Notes</label><input type="text" className="input-field" value={form.notes} onChange={e => set({ notes: e.target.value })} /></div>
                    </div>
                )}
                {activeModal === 'reviews' && (
                    <div className="form-grid">
                        <div className="input-group"><label className="input-label">Review Date</label><input type="date" className="input-field" value={form.date} onChange={e => set({ date: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Rating (1-10)</label><input type="number" min="1" max="10" className="input-field" value={form.progressRating} onChange={e => set({ progressRating: e.target.value })} /></div>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}><label className="input-label">Progress Notes</label><textarea className="input-field" rows="2" value={form.notes} onChange={e => set({ notes: e.target.value })} /></div>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}><label className="input-label">Next Steps</label><input type="text" className="input-field" value={form.nextSteps} onChange={e => set({ nextSteps: e.target.value })} /></div>
                    </div>
                )}
                {activeModal === 'supplements' && (
                    <div className="form-grid">
                        <datalist id="supplementTypes">
                            <option value="Protein" /><option value="Creatine" /><option value="Pre-Workout" /><option value="BCAA" /><option value="Vitamins" /><option value="Omega-3" /><option value="Mass Gainer" /><option value="Fat Burner" />
                        </datalist>
                        <div className="input-group"><label className="input-label">Type</label><input type="text" list="supplementTypes" className="input-field" placeholder="e.g. Protein" value={form.type} onChange={e => set({ type: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Name</label><input type="text" className="input-field" placeholder="e.g. Whey Isolate" value={form.name} onChange={e => set({ name: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Dosage <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label><input type="text" className="input-field" placeholder="e.g. 30g daily" value={form.dosage} onChange={e => set({ dosage: e.target.value })} /></div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </Modal>
        </>
    );
};

export default HealthProFeatures;
