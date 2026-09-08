import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { ptApi } from '../../api/pt';

const STATUS_OPTIONS = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'no_show', label: 'No-show' }
];

// Two staff can share a name, and a facility's admin accounts are often named
// after the gym itself — so a bare name list can show the same label several
// times with no way to tell the entries apart. Fall back to the email only
// where a name actually repeats, rather than cluttering every row.
export const trainerLabel = (trainer, all) => {
    const sameName = all.filter((t) => t.name === trainer.name);
    if (sameName.length < 2) return trainer.name;
    return `${trainer.name} · ${trainer.email || `#${trainer.id}`}`;
};

// Convert a date value to the value a <input type="datetime-local"> expects.
const toLocalInput = (value) => {
    const d = value ? new Date(value) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Shared modal for logging a new PT session or editing an existing one.
const SessionModal = ({ isOpen, onClose, onSaved, session, presetClientId, members = [], trainers = [] }) => {
    const { addToast } = useToast();
    const isEdit = !!session;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        clientId: '', trainerId: '', sessionDate: toLocalInput(), durationMinutes: '', status: 'scheduled', notes: '', override: false
    });

    useEffect(() => {
        if (!isOpen) return;
        if (session) {
            setForm({
                clientId: session.clientId,
                trainerId: session.trainerId || '',
                sessionDate: toLocalInput(session.sessionDate),
                durationMinutes: session.durationMinutes || '',
                status: session.status,
                notes: session.notes || '',
                override: false
            });
        } else {
            setForm({
                clientId: presetClientId || '', trainerId: '', sessionDate: toLocalInput(),
                durationMinutes: '', status: 'scheduled', notes: '', override: false
            });
        }
    }, [isOpen, session, presetClientId]);

    const selectedMember = members.find((m) => String(m.id) === String(form.clientId));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.clientId) return addToast('Select a member', 'error');
        try {
            setSaving(true);
            const payload = {
                clientId: form.clientId,
                trainerId: form.trainerId || null,
                sessionDate: new Date(form.sessionDate).toISOString(),
                durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
                status: form.status,
                notes: form.notes || null,
                override: form.override
            };
            if (isEdit) await ptApi.updateSession(session.id, payload);
            else await ptApi.createSession(payload);
            addToast(isEdit ? 'Session updated' : 'Session logged', 'success');
            onSaved && onSaved();
            onClose();
        } catch (err) {
            const data = err.response?.data;
            if (data?.code === 'PT_LIMIT_REACHED') {
                addToast(data.message || 'PT session limit reached', 'error');
            } else {
                addToast(data?.message || data?.error || 'Failed to save session', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit PT Session' : 'Log PT Session'}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                    <label className="input-label">Member</label>
                    <select className="input-field" value={form.clientId} disabled={isEdit || !!presetClientId}
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                        <option value="">Select PT Member</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {selectedMember?.usage && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {selectedMember.usage.used}/{selectedMember.usage.allowed} used this {selectedMember.usage.period === 'monthly' ? 'month' : 'week'} · {selectedMember.usage.remaining} remaining
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Trainer</label>
                        <select className="input-field" value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                            <option value="">Unassigned</option>
                            {trainers.map((t) => <option key={t.id} value={t.id}>{trainerLabel(t, trainers)}</option>)}
                        </select>
                        {trainers.length === 0 && (
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                No trainers yet — add a staff member under <b>Staff</b> to assign one.
                                Sessions can be logged as Unassigned in the meantime.
                            </p>
                        )}
                    </div>
                    <div className="input-group" style={{ width: 130 }}>
                        <label className="input-label">Duration (min)</label>
                        <input type="number" min="0" className="input-field" value={form.durationMinutes}
                            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="60" />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Date & Time</label>
                        <input type="datetime-local" className="input-field" value={form.sessionDate}
                            onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} required />
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Status</label>
                        <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">Notes</label>
                    <textarea className="input-field" rows="2" value={form.notes} style={{ resize: 'vertical' }}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Session focus, progress, remarks…" />
                </div>

                {form.status === 'completed' && selectedMember?.usage?.atLimit && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--warning, #F59E0B)' }}>
                        <input type="checkbox" checked={form.override} onChange={(e) => setForm({ ...form, override: e.target.checked })} />
                        Override session limit (admin) — member has used all allowed sessions this period
                    </label>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Log Session')}</button>
                </div>
            </form>
        </Modal>
    );
};

export default SessionModal;
