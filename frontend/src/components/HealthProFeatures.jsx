import React, { useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2, Activity, Target, Trophy, Stethoscope } from 'lucide-react';
import { formatDate } from '../utils/date';

const HealthProFeatures = ({ profile, clientId, fetchData }) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('composition');

    // Forms
    const [compositionForm, setCompositionForm] = useState({ date: new Date().toISOString().split('T')[0], bodyFatPercentage: '', muscleMass: '', weight: '' });
    const [measurementForm, setMeasurementForm] = useState({ date: new Date().toISOString().split('T')[0], arms: '', chest: '', waist: '', legs: '', calves: '' });
    const [prForm, setPrForm] = useState({ date: new Date().toISOString().split('T')[0], exercise: '', weight: '', reps: '', notes: '' });
    
    const [testForm, setTestForm] = useState({ date: new Date().toISOString().split('T')[0], testName: '', score: '', notes: '' });
    const [mobilityForm, setMobilityForm] = useState({ date: new Date().toISOString().split('T')[0], joint: '', status: 'Good', notes: '' });
    const [reviewForm, setReviewForm] = useState({ date: new Date().toISOString().split('T')[0], progressRating: 5, notes: '', nextSteps: '' });

    const tabs = [
        { id: 'composition', label: 'Body Composition', icon: Activity },
        { id: 'measurements', label: 'Measurements', icon: Target },
        { id: 'prs', label: 'Personal Records', icon: Trophy },
        { id: 'tests', label: 'Fitness Tests', icon: Activity },
        { id: 'mobility', label: 'Mobility', icon: Stethoscope },
        { id: 'reviews', label: 'Goal Reviews', icon: Target }
    ];

    // Handlers
    const handleAddComposition = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/body-composition`, {
                date: compositionForm.date,
                weight: compositionForm.weight,
                bodyFat: compositionForm.bodyFatPercentage,
                notes: `Muscle Mass: ${compositionForm.muscleMass}kg`
            });
            addToast('Body composition logged', 'success');
            setCompositionForm({ date: new Date().toISOString().split('T')[0], bodyFatPercentage: '', muscleMass: '', weight: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    const handleAddMeasurement = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/measurements`, {
                date: measurementForm.date,
                arms: measurementForm.arms,
                chest: measurementForm.chest,
                waist: measurementForm.waist,
                thighs: measurementForm.legs,
                notes: `Calves: ${measurementForm.calves}`
            });
            addToast('Measurements logged', 'success');
            setMeasurementForm({ date: new Date().toISOString().split('T')[0], arms: '', chest: '', waist: '', legs: '', calves: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    const handleAddPr = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/personal-records`, prForm);
            addToast('Personal Record logged', 'success');
            setPrForm({ date: new Date().toISOString().split('T')[0], exercise: '', weight: '', reps: '', notes: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    const handleAddTest = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/fitness-tests`, {
                date: testForm.date,
                label: testForm.testName,
                score: testForm.score,
                notes: testForm.notes
            });
            addToast('Fitness test logged', 'success');
            setTestForm({ date: new Date().toISOString().split('T')[0], testName: '', score: '', notes: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    const handleAddMobility = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/mobility-screenings`, {
                date: mobilityForm.date,
                areas: [{ name: mobilityForm.joint, status: mobilityForm.status }],
                notes: mobilityForm.notes
            });
            addToast('Mobility screening logged', 'success');
            setMobilityForm({ date: new Date().toISOString().split('T')[0], joint: '', status: 'Good', notes: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    const handleAddReview = async () => {
        try {
            await api.post(`/clients/${clientId}/health-profile/goal-reviews`, {
                date: reviewForm.date,
                progressRating: reviewForm.progressRating,
                notes: reviewForm.notes + (reviewForm.nextSteps ? `\nNext Steps: ${reviewForm.nextSteps}` : '')
            });
            addToast('Goal review logged', 'success');
            setReviewForm({ date: new Date().toISOString().split('T')[0], progressRating: 5, notes: '', nextSteps: '' });
            fetchData();
        } catch (e) {
            addToast('Failed to log data', 'error');
        }
    };

    return (
        <div className="card" style={{ marginTop: '2rem', padding: '0' }}>
            {/* Header Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem 1.5rem', background: 'transparent',
                                border: 'none', borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                            }}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ padding: '1.5rem' }}>
                {/* Body Composition Tab */}
                {activeTab === 'composition' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
                                <label className="input-label">Date</label>
                                <input type="date" className="input-field" value={compositionForm.date} onChange={e => setCompositionForm({...compositionForm, date: e.target.value})} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
                                <label className="input-label">Weight (kg)</label>
                                <input type="number" className="input-field" value={compositionForm.weight} onChange={e => setCompositionForm({...compositionForm, weight: e.target.value})} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
                                <label className="input-label">Body Fat %</label>
                                <input type="number" className="input-field" value={compositionForm.bodyFatPercentage} onChange={e => setCompositionForm({...compositionForm, bodyFatPercentage: e.target.value})} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
                                <label className="input-label">Muscle Mass (kg)</label>
                                <input type="number" className="input-field" value={compositionForm.muscleMass} onChange={e => setCompositionForm({...compositionForm, muscleMass: e.target.value})} />
                            </div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddComposition}>
                                <Plus size={18} /> Add
                            </button>
                        </div>

                        <table className="modern-table" style={{ width: '100%', background: 'var(--bg-body)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <tr><th>Date</th><th>Weight (kg)</th><th>Body Fat %</th><th>Muscle Mass (kg)</th></tr>
                            </thead>
                            <tbody>
                                {(profile.bodyCompositionHistory || []).map((log, i) => (
                                    <tr key={i}>
                                        <td>{formatDate(log.date)}</td>
                                        <td>{log.weight || '--'}</td>
                                        <td>{log.bodyFat || '--'}</td>
                                        <td>{log.notes ? log.notes.replace('Muscle Mass: ', '').replace('kg', '') : '--'}</td>
                                    </tr>
                                ))}
                                {(!profile.bodyCompositionHistory || profile.bodyCompositionHistory.length === 0) && (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No logs yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Measurements Tab */}
                {activeTab === 'measurements' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: '1 1 120px' }}><label className="input-label">Date</label><input type="date" className="input-field" value={measurementForm.date} onChange={e => setMeasurementForm({...measurementForm, date: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 80px' }}><label className="input-label">Arms</label><input type="number" className="input-field" value={measurementForm.arms} onChange={e => setMeasurementForm({...measurementForm, arms: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 80px' }}><label className="input-label">Chest</label><input type="number" className="input-field" value={measurementForm.chest} onChange={e => setMeasurementForm({...measurementForm, chest: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 80px' }}><label className="input-label">Waist</label><input type="number" className="input-field" value={measurementForm.waist} onChange={e => setMeasurementForm({...measurementForm, waist: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 80px' }}><label className="input-label">Legs</label><input type="number" className="input-field" value={measurementForm.legs} onChange={e => setMeasurementForm({...measurementForm, legs: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 80px' }}><label className="input-label">Calves</label><input type="number" className="input-field" value={measurementForm.calves} onChange={e => setMeasurementForm({...measurementForm, calves: e.target.value})} /></div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddMeasurement}><Plus size={18} /> Add</button>
                        </div>
                        <table className="modern-table" style={{ width: '100%', background: 'var(--bg-body)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <tr><th>Date</th><th>Arms</th><th>Chest</th><th>Waist</th><th>Legs</th><th>Calves</th></tr>
                            </thead>
                            <tbody>
                                {(profile.measurementLogs || []).map((log, i) => (
                                    <tr key={i}>
                                        <td>{formatDate(log.date)}</td>
                                        <td>{log.arms || '--'}</td>
                                        <td>{log.chest || '--'}</td>
                                        <td>{log.waist || '--'}</td>
                                        <td>{log.thighs || '--'}</td>
                                        <td>{log.notes ? log.notes.replace('Calves: ', '') : '--'}</td>
                                    </tr>
                                ))}
                                {(!profile.measurementLogs || profile.measurementLogs.length === 0) && (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No logs yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* PRs Tab */}
                {activeTab === 'prs' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: '1 1 120px' }}><label className="input-label">Date</label><input type="date" className="input-field" value={prForm.date} onChange={e => setPrForm({...prForm, date: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 150px' }}><label className="input-label">Exercise</label><input type="text" className="input-field" placeholder="e.g. Deadlift" value={prForm.exercise} onChange={e => setPrForm({...prForm, exercise: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 100px' }}><label className="input-label">Weight (kg)</label><input type="number" className="input-field" value={prForm.weight} onChange={e => setPrForm({...prForm, weight: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 100px' }}><label className="input-label">Reps</label><input type="number" className="input-field" value={prForm.reps} onChange={e => setPrForm({...prForm, reps: e.target.value})} /></div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddPr}><Plus size={18} /> Add</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                            {(profile.personalRecords || []).map((log, i) => (
                                <div key={i} style={{ background: 'var(--bg-body)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '50%', boxShadow: '0 4px 8px var(--primary-glow)' }}>
                                        <Trophy size={14} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{formatDate(log.date)}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{log.exercise}</div>
                                    <div style={{ fontSize: '1.25rem', color: 'var(--text-highlight)', fontWeight: 800, marginTop: '8px' }}>
                                        {log.weight}kg <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>× {log.reps} reps</span>
                                    </div>
                                </div>
                            ))}
                            {(!profile.personalRecords || profile.personalRecords.length === 0) && (
                                <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PRs logged yet. Let's break some records!</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Fitness Tests Tab */}
                {activeTab === 'tests' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: '1 1 120px' }}><label className="input-label">Date</label><input type="date" className="input-field" value={testForm.date} onChange={e => setTestForm({...testForm, date: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 150px' }}><label className="input-label">Test Name</label><input type="text" className="input-field" placeholder="e.g. 1 Mile Run" value={testForm.testName} onChange={e => setTestForm({...testForm, testName: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 100px' }}><label className="input-label">Score/Time</label><input type="text" className="input-field" placeholder="e.g. 6:30" value={testForm.score} onChange={e => setTestForm({...testForm, score: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 200px' }}><label className="input-label">Notes</label><input type="text" className="input-field" value={testForm.notes} onChange={e => setTestForm({...testForm, notes: e.target.value})} /></div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddTest}><Plus size={18} /> Add</button>
                        </div>
                        <table className="modern-table" style={{ width: '100%', background: 'var(--bg-body)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <tr><th>Date</th><th>Test</th><th>Score</th><th>Notes</th></tr>
                            </thead>
                            <tbody>
                                {(profile.fitnessTests || []).map((log, i) => (
                                    <tr key={i}>
                                        <td>{formatDate(log.date)}</td>
                                        <td style={{ fontWeight: 600 }}>{log.label || log.type}</td>
                                        <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{log.score}</td>
                                        <td>{log.notes}</td>
                                    </tr>
                                ))}
                                {(!profile.fitnessTests || profile.fitnessTests.length === 0) && (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tests logged yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Mobility Tab */}
                {activeTab === 'mobility' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: '1 1 120px' }}><label className="input-label">Date</label><input type="date" className="input-field" value={mobilityForm.date} onChange={e => setMobilityForm({...mobilityForm, date: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 150px' }}><label className="input-label">Joint/Area</label><input type="text" className="input-field" placeholder="e.g. Shoulders" value={mobilityForm.joint} onChange={e => setMobilityForm({...mobilityForm, joint: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 100px' }}><label className="input-label">Status</label>
                                <select className="input-field" value={mobilityForm.status} onChange={e => setMobilityForm({...mobilityForm, status: e.target.value})}>
                                    <option value="Excellent">Excellent</option>
                                    <option value="Good">Good</option>
                                    <option value="Fair">Fair</option>
                                    <option value="Poor">Poor</option>
                                    <option value="Restricted">Restricted</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ flex: '1 1 200px' }}><label className="input-label">Notes</label><input type="text" className="input-field" value={mobilityForm.notes} onChange={e => setMobilityForm({...mobilityForm, notes: e.target.value})} /></div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddMobility}><Plus size={18} /> Add</button>
                        </div>
                        <table className="modern-table" style={{ width: '100%', background: 'var(--bg-body)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <tr><th>Date</th><th>Joint/Area</th><th>Status</th><th>Notes</th></tr>
                            </thead>
                            <tbody>
                                {(profile.mobilityScreenings || []).map((log, i) => {
                                    const area = log.areas && log.areas[0] ? log.areas[0] : { name: '--', status: '--' };
                                    return (
                                        <tr key={i}>
                                            <td>{formatDate(log.date)}</td>
                                            <td style={{ fontWeight: 600 }}>{area.name}</td>
                                            <td>
                                                <span className="status-badge" style={{ background: area.status === 'Excellent' || area.status === 'Good' ? 'rgba(16, 185, 129, 0.1)' : area.status === 'Fair' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: area.status === 'Excellent' || area.status === 'Good' ? '#10b981' : area.status === 'Fair' ? '#f59e0b' : '#ef4444' }}>
                                                    {area.status}
                                                </span>
                                            </td>
                                            <td>{log.notes}</td>
                                        </tr>
                                    );
                                })}
                                {(!profile.mobilityScreenings || profile.mobilityScreenings.length === 0) && (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No mobility screenings logged yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Goal Reviews Tab */}
                {activeTab === 'reviews' && (
                    <div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: '1 1 120px' }}><label className="input-label">Review Date</label><input type="date" className="input-field" value={reviewForm.date} onChange={e => setReviewForm({...reviewForm, date: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 100px' }}><label className="input-label">Rating (1-10)</label><input type="number" min="1" max="10" className="input-field" value={reviewForm.progressRating} onChange={e => setReviewForm({...reviewForm, progressRating: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 200px' }}><label className="input-label">Progress Notes</label><input type="text" className="input-field" value={reviewForm.notes} onChange={e => setReviewForm({...reviewForm, notes: e.target.value})} /></div>
                            <div className="input-group" style={{ flex: '1 1 200px' }}><label className="input-label">Next Steps</label><input type="text" className="input-field" value={reviewForm.nextSteps} onChange={e => setReviewForm({...reviewForm, nextSteps: e.target.value})} /></div>
                            <button className="btn btn-primary" style={{ padding: '10px 16px', height: '42px' }} onClick={handleAddReview}><Plus size={18} /> Add</button>
                        </div>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {(profile.goalReviews || []).map((log, i) => (
                                <div key={i} style={{ background: 'var(--bg-body)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(log.reviewDate || log.date)}</div>
                                        <div style={{ background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            Rating: {log.progressRating}/10
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Progress Notes</div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{log.notes}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!profile.goalReviews || profile.goalReviews.length === 0) && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No goal reviews logged yet.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HealthProFeatures;
