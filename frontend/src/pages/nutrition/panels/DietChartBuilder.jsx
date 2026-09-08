import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../context/ToastContext';
import { dieticianApi } from '../../../api/dietician';
import { readDraft, writeDraft, clearDraft } from '../../../utils/dietChartDrafts';
import { nutritionApi } from '../../../api/nutrition';
import {
    ArrowLeft, Save, ChevronDown, Plus, Trash2, Lock, Utensils,
    User, Activity, FlaskConical, HeartPulse, Dumbbell, Pill, Salad,
    ClipboardList, CalendarCheck, Target, ListChecks, LineChart, AlertCircle, RefreshCw
} from 'lucide-react';

// ── Preset rows (mirroring the printed assessment template) ──────────────────
const PRESET = {
    bodyComposition: ['Weight', 'BMI', 'Body Fat %', 'Fat Mass', 'Lean Body Mass', 'Skeletal Muscle Mass', 'Visceral Fat', 'Total Body Water %', 'BMR', 'Metabolic Age', 'Waist-Hip Ratio'],
    biochemical: ['Hb', 'FBS', 'PPBS', 'HbA1c', 'Total Cholesterol', 'LDL', 'HDL', 'Triglycerides', 'Vitamin D', 'Vitamin B12', 'Iron/Ferritin', 'Calcium', 'Magnesium', 'TSH', 'Creatinine', 'SGOT/AST', 'SGPT/ALT'],
    familyHistory: ['Diabetes', 'Hypertension', 'Dyslipidemia', 'Obesity', 'Heart disease', 'Kidney disease', 'Thyroid disease'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    followUp: ['Weight', 'BMI', 'Body Fat %', 'Muscle Mass', 'Waist Circumference', 'Energy Level', 'Exercise Adherence', 'Diet Adherence %'],
    mealTypes: ['Early morning', 'Breakfast', 'Mid-morning', 'Lunch', 'Evening snack', 'Dinner', 'Bedtime']
};

const MAX_OPTIONS = 5;
const emptyOption = () => ({ items: [{}], note: '' });
const emptyMeal = () => ({ time: '', mealType: '', options: [emptyOption()] });

const mealCardStyle = { border: '1px solid var(--border-color)', borderRadius: 12, padding: '1rem 1.15rem', background: 'var(--bg-body)' };
const optionCardStyle = { border: '1px dashed var(--border-color)', borderRadius: 10, padding: '0.75rem 0.85rem', background: 'var(--bg-hover)' };

// A meal holds up to 5 options, each a combination of food items. Normalize both
// the new shape and the older flat shape (single food per meal) on load so
// existing charts keep working. Empty plan → one blank meal to start from.
const normalizeMealPlan = (rows) => {
    const arr = Array.isArray(rows) && rows.length ? rows : [emptyMeal()];
    return arr.map((r) => {
        if (Array.isArray(r.options)) {
            return { time: r.time || '', mealType: r.mealType || '', options: r.options.length ? r.options : [emptyOption()] };
        }
        // Legacy flat row → one option with a single item.
        const hasContent = r.food || r.calories != null || r.protein != null || r.otherNutrients;
        return {
            time: r.time || '',
            mealType: r.mealType || '',
            options: [{
                items: [hasContent ? { food: r.food || '', calories: r.calories, protein: r.protein, foodId: r.foodId } : {}],
                note: r.otherNutrients || ''
            }]
        };
    });
};

// ── Section registry ─────────────────────────────────────────────────────────
// The fourteen assessment sections, in order. `filled` reports whether the
// dietician has put anything in that section — it drives the completion dots in
// the navigation rail and the progress meter, so the form can be picked up and
// put down without having to open every panel to find out what is left.
//
// Every section here maps 1:1 to the printed assessment template. No field has
// been added, removed or renamed.
const anyValue = (obj) => !!obj && Object.values(obj).some((v) => v != null && String(v).trim() !== '');
const anyRow = (rows) => Array.isArray(rows) && rows.some((r) => anyValue(r));

const SECTIONS = [
    { id: 1, label: 'Personal Information', icon: User, filled: (d) => anyValue(d.personalInfo) },
    { id: 2, label: 'Body Composition', icon: Activity, filled: (d) => anyRow(d.bodyComposition) || !!d.bodyCompositionNotes },
    { id: 3, label: 'Biochemical Report', icon: FlaskConical, filled: (d) => anyRow(d.biochemical) },
    { id: 4, label: 'Medical & Family History', icon: HeartPulse, filled: (d) => anyValue(d.medicalHistory) || anyRow(d.familyHistory) },
    { id: 5, label: 'Exercise / Activity', icon: Dumbbell, filled: (d) => anyRow(d.exerciseChart) || anyValue(d.activitySummary) },
    { id: 6, label: 'Medication', icon: Pill, filled: (d) => anyRow(d.medications) },
    { id: 7, label: 'Supplements', icon: Pill, filled: (d) => anyRow(d.supplements) },
    { id: 8, label: 'Dietary Preferences', icon: Salad, filled: (d) => anyValue(d.dietaryPreferences) },
    { id: 9, label: 'Diet Recall', icon: ClipboardList, filled: (d) => anyRow(d.dietRecall) || anyValue(d.dietRecallSummary) },
    { id: 10, label: 'Diet Tracker', icon: CalendarCheck, filled: (d) => anyRow(d.dietTracker) },
    { id: 11, label: 'Nutrition Goals', icon: Target, locked: true, filled: (d) => anyValue(d.nutritionGoals) },
    { id: 12, label: 'Individualized Diet Plan', icon: Utensils, locked: true, filled: (d) => (d.mealPlan || []).some((m) => m.mealType || (m.options || []).some((o) => (o.items || []).some((it) => it.food) || o.note)) || anyValue(d.mealSpec) },
    { id: 13, label: 'General Guidelines', icon: ListChecks, locked: true, filled: (d) => ((d.guidelines?.food || []).join('') + (d.guidelines?.lifestyle || []).join('')).trim() !== '' },
    { id: 14, label: 'Follow-up & Monitoring', icon: LineChart, filled: (d) => anyRow(d.followUp) || !!d.dietitianRemarks || !!d.nextFollowUpDate }
];

// ── Small building blocks ────────────────────────────────────────────────────

// A section panel. Open/closed state lives in the parent so the navigation rail
// can jump to a section and open it, and so an error can reveal the section that
// holds it.
const Section = ({ id, subtitle, open, onToggle, errorCount = 0, children }) => {
    const meta = SECTIONS.find((x) => x.id === id) || {};
    const Icon = meta.icon || ClipboardList;
    const hasErrors = errorCount > 0;

    return (
        <div id={`dcs-${id}`} className="card"
            style={{
                padding: 0, marginBottom: '0.9rem', overflow: 'hidden', scrollMarginTop: 96,
                border: `1px solid ${hasErrors ? 'var(--danger)' : 'var(--border-color)'}`
            }}>
            <button type="button" onClick={onToggle} aria-expanded={open}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    padding: '0.9rem 1.1rem', background: open ? 'var(--bg-hover)' : 'transparent', border: 'none',
                    borderBottom: open ? '1px solid var(--border-color)' : '1px solid transparent',
                    cursor: 'pointer', textAlign: 'left', color: 'var(--text-main)', transition: 'background .15s'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <span style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: open ? 'linear-gradient(135deg, var(--primary), #34D399)' : 'var(--bg-hover)',
                        color: open ? '#fff' : 'var(--primary)', transition: 'all .15s'
                    }}>
                        <Icon size={17} strokeWidth={2.1} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>{String(id).padStart(2, '0')}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{meta.label}</span>
                            {meta.locked && <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> Dietician only</span>}
                            {hasErrors && (
                                <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <AlertCircle size={10} /> {errorCount}
                                </span>
                            )}
                        </div>
                        {subtitle && <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 1 }}>{subtitle}</div>}
                    </div>
                </div>
                <ChevronDown size={18} style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </button>
            {open && <div style={{ padding: '1.25rem 1.1rem' }}>{children}</div>}
        </div>
    );
};

// Left-hand navigation rail: the map the form never had. One row per section
// with a filled/empty dot and an error count, so what is done and what still
// needs attention is answerable without opening anything.
const SectionRail = ({ data, openIds, errorsBySection, onJump, onExpandAll, onCollapseAll }) => {
    const done = SECTIONS.filter((sec) => sec.filled(data)).length;
    const pct = Math.round((done / SECTIONS.length) * 100);

    return (
        <nav aria-label="Chart sections" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="card" style={{ padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Progress</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{done} / {SECTIONS.length}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--primary), #34D399)', transition: 'width .25s' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={onExpandAll} style={railLinkStyle}>Expand all</button>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <button type="button" onClick={onCollapseAll} style={railLinkStyle}>Collapse all</button>
                </div>
            </div>

            <div className="card" style={{ padding: '0.4rem' }}>
                {SECTIONS.map((sec) => {
                    const filled = sec.filled(data);
                    const errs = (errorsBySection[sec.id] || []).length;
                    const isOpen = openIds.has(sec.id);
                    return (
                        <button key={sec.id} type="button" onClick={() => onJump(sec.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                                padding: '0.5rem 0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: isOpen ? 'var(--bg-active)' : 'transparent',
                                color: 'var(--text-main)', font: 'inherit', fontSize: '0.83rem'
                            }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                                background: errs ? 'var(--danger)' : (filled ? 'var(--primary)' : 'transparent'),
                                border: errs || filled ? 'none' : '1.5px solid var(--border-color)'
                            }} />
                            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', flexShrink: 0 }}>
                                {String(sec.id).padStart(2, '0')}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isOpen ? 700 : 500 }}>
                                {sec.label}
                            </span>
                            {errs > 0 && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--danger)', flexShrink: 0 }}>{errs}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

const railLinkStyle = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: 'var(--primary)', fontWeight: 600, fontSize: '0.76rem', font: 'inherit'
};

// Sized field wrapper. Fields grow to fill their row but are capped so short
// inputs (numbers, dates) never stretch to an awkward full width.
const FIELD_SIZE = {
    xs: { basis: 96, min: 84, max: 120 },   // very short: age, bmi
    sm: { basis: 130, min: 116, max: 176 }, // numbers, dates, targets
    md: { basis: 200, min: 150, max: 300 }, // default: text, selects
    lg: { basis: 300, min: 200, max: 460 }  // longer text
};

const Field = ({ label, children, size = 'md', full = false }) => {
    const s = FIELD_SIZE[size] || FIELD_SIZE.md;
    const style = full
        ? { flex: '1 1 100%', maxWidth: '100%', minWidth: 0 }
        : { flex: `1 1 ${s.basis}px`, minWidth: s.min, maxWidth: s.max };
    return (
        <div className="input-group" style={{ ...style, marginBottom: 0 }}>
            {label && <label className="input-label" style={{ fontSize: '0.78rem' }}>{label}</label>}
            {children}
        </div>
    );
};

const Row = ({ children }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginBottom: '1rem', alignItems: 'flex-start' }}>{children}</div>
);

// Editable repeating table. `columns` = [{key,label,type,width,options}].
// Wide tables (Diet Tracker has nine columns) scroll sideways, so a row loses
// its identity the moment you scroll right. A row number and a sticky first
// column keep it anchored.
const RepeatTable = ({ columns, rows = [], onChange, disabled, addLabel = 'Add row' }) => {
    const update = (i, key, val) => {
        const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
        onChange(next);
    };
    const addRow = () => onChange([...rows, {}]);
    const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

    const stickyCell = (isHeader) => ({
        position: 'sticky', left: 0, zIndex: 1,
        background: isHeader ? 'var(--bg-hover)' : 'var(--bg-card, var(--bg-body))'
    });

    return (
        <div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: columns.length * 130 }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            <th style={{ ...stickyCell(true), width: 34, padding: '0.4rem 0.5rem', fontWeight: 600 }}>#</th>
                            {columns.map((c) => <th key={c.key} style={{ padding: '0.4rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</th>)}
                            {!disabled && <th style={{ width: 36 }} />}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                <td style={{ ...stickyCell(false), padding: '0.25rem 0.5rem', verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                                    {i + 1}
                                </td>
                                {columns.map((c) => (
                                    <td key={c.key} style={{ padding: '0.25rem 0.35rem', verticalAlign: 'top', width: c.width }}>
                                        {c.options ? (
                                            <select className="input-field" style={cellInput} disabled={disabled} value={r[c.key] || ''} onChange={(e) => update(i, c.key, e.target.value)}>
                                                <option value="">—</option>
                                                {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input className="input-field" style={cellInput} disabled={disabled}
                                                type={c.type === 'number' ? 'number' : 'text'}
                                                value={r[c.key] ?? ''} onChange={(e) => update(i, c.key, e.target.value)} placeholder={c.placeholder || ''} />
                                        )}
                                    </td>
                                ))}
                                {!disabled && (
                                    <td style={{ padding: '0.25rem', verticalAlign: 'top' }}>
                                        <button type="button" className="icon-btn" title="Remove" onClick={() => removeRow(i)} style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={columns.length + 2} style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No entries.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {!disabled && (
                <button type="button" className="btn btn-secondary" onClick={addRow} style={{ marginTop: '0.6rem', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                    <Plus size={15} /> {addLabel}
                </button>
            )}
        </div>
    );
};

const cellInput = { padding: '0.45rem 0.55rem', fontSize: '0.85rem', minWidth: 110 };

const GOALS = [
    ['weight_loss', 'Weight loss'], ['weight_gain', 'Weight gain'], ['maintenance', 'Maintenance'],
    ['muscle_gain', 'Muscle gain'], ['performance', 'Performance'], ['therapeutic', 'Therapeutic']
];

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
const STATUS_TONE = { draft: '#F59E0B', active: '#22C55E', archived: '#64748B' };

// Merge the client's health-profile data (hs) into a diet-chart data object:
// fills empty personal-info / goal metrics, and appends supplements + body-
// composition rows that aren't already present. Non-destructive.
const mergeHealthIntoData = (data, hs) => {
    if (!hs) return data;
    const blank = (v) => v == null || String(v).trim() === '';
    const d = { ...data };

    const pi = { ...(d.personalInfo || {}) };
    if (blank(pi.height) && hs.height != null) pi.height = String(hs.height);
    if (blank(pi.weight) && hs.weight != null) pi.weight = String(hs.weight);
    if (blank(pi.bmi) && hs.bmi != null) pi.bmi = String(hs.bmi);
    if (blank(pi.waist) && hs.waist != null) pi.waist = String(hs.waist);
    d.personalInfo = pi;

    const ng = { ...(d.nutritionGoals || {}) };
    if (blank(ng.targetWeight) && hs.targetWeight != null) ng.targetWeight = String(hs.targetWeight);
    d.nutritionGoals = ng;

    const haveSupp = new Set((d.supplements || []).map((s) => String(s.supplement || '').toLowerCase().trim()).filter(Boolean));
    const addSupp = (hs.supplements || [])
        .filter((s) => s.name && !haveSupp.has(String(s.name).toLowerCase().trim()))
        .map((s) => ({ supplement: s.name, purpose: s.type || '', dose: s.dosage || '' }));
    d.supplements = [...(d.supplements || []), ...addSupp];

    // Section 5 — lay the trainer's programmed week into the exercise chart, so
    // it isn't retyped from a schedule the system already holds. Only fills days
    // the dietician hasn't already written.
    if (hs.workoutSchedule && Array.isArray(hs.workoutSchedule.days)) {
        const haveDay = new Set((d.exerciseChart || [])
            .map((r) => String(r.day || '').toLowerCase().trim()).filter(Boolean));
        const addDays = hs.workoutSchedule.days
            .filter((row) => !haveDay.has(String(row.day || '').toLowerCase().trim()))
            .map((row) => ({
                day: row.day,
                activity: row.activity || '',
                remarks: row.exercises ? `${row.exercises} exercises programmed` : ''
            }));
        d.exerciseChart = [...(d.exerciseChart || []), ...addDays];
    }

    const haveBC = new Set((d.bodyComposition || []).map((r) => String(r.parameter || '').toLowerCase().trim()).filter(Boolean));
    const bc = [];
    if (hs.bodyFat != null && !haveBC.has('body fat %')) bc.push({ parameter: 'Body Fat %', current: String(hs.bodyFat) });
    if (hs.muscleMass != null && !haveBC.has('skeletal muscle mass')) bc.push({ parameter: 'Skeletal Muscle Mass', current: String(hs.muscleMass) });
    const bcWeight = hs.bodyCompWeight ?? hs.weight;
    if (bcWeight != null && !haveBC.has('weight')) bc.push({ parameter: 'Weight', current: String(bcWeight) });
    d.bodyComposition = [...(d.bodyComposition || []), ...bc];

    return d;
};

// ── Main builder ─────────────────────────────────────────────────────────────
const DietChartBuilder = ({ chartId, facilityId, readOnly = false, onBack }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientId, setClientId] = useState(null);
    const [foods, setFoods] = useState([]);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState([]);
    const [healthSource, setHealthSource] = useState(null);
    // Which panels are expanded. Lives here (not inside Section) so the rail can
    // jump to a section, and so a validation error can reveal the one holding it.
    const [openIds, setOpenIds] = useState(() => new Set([1, 12]));
    // Set once the dietician changes anything, so Back can warn before
    // discarding. The form used to throw the work away silently.
    const [dirty, setDirty] = useState(false);
    // Which meal options are expanded, keyed "mealIndex:optionIndex". Six meals
    // with three options each rendered ~90 inputs at once; collapsed options
    // show a one-line summary and open on click. Option 1 of each meal starts
    // open so the plan is never a wall of closed rows.
    const [openOpts, setOpenOpts] = useState(() => new Set());
    // A recovered local draft awaiting the dietician's decision.
    const [draftOffer, setDraftOffer] = useState(null);

    // Health sections can be edited by admins and dieticians; plan sections
    // (goals, meal plan, meal spec, guidelines) are dietician-only.
    const planDisabled = readOnly;

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [chart, foodList] = await Promise.all([
                    dieticianApi.getChart(chartId, facilityId),
                    nutritionApi.getFoods(facilityId).catch(() => [])
                ]);
                setFoods(foodList || []);
                setClientName(chart.Client?.name || '');
                setClientId(chart.Client?.id || null);
                const d = chart.data || {};
                let data = {
                    personalInfo: d.personalInfo || {},
                    bodyComposition: d.bodyComposition || [],
                    bodyCompositionNotes: d.bodyCompositionNotes || '',
                    biochemical: d.biochemical || [],
                    medicalHistory: d.medicalHistory || {},
                    familyHistory: d.familyHistory || [],
                    exerciseChart: d.exerciseChart || [],
                    activitySummary: d.activitySummary || {},
                    medications: d.medications || [],
                    supplements: d.supplements || [],
                    dietaryPreferences: d.dietaryPreferences || {},
                    dietRecall: d.dietRecall || [],
                    dietRecallSummary: d.dietRecallSummary || {},
                    dietTracker: d.dietTracker || [],
                    nutritionGoals: d.nutritionGoals || {},
                    mealPlan: normalizeMealPlan(d.mealPlan),
                    mealSpec: d.mealSpec || {},
                    guidelines: d.guidelines || { food: [], lifestyle: [] },
                    followUp: d.followUp || [],
                    dietitianRemarks: d.dietitianRemarks || '',
                    nextFollowUpDate: d.nextFollowUpDate || ''
                };

                // Pull the client's health-profile data (supplements, metrics, body
                // composition). Auto-sync it into brand-new charts; otherwise keep
                // it available for the manual "Sync from health profile" button.
                const clientId = chart.Client?.id;
                if (clientId) {
                    const hs = await dieticianApi.getClientHealth(clientId, facilityId).catch(() => null);
                    if (hs) {
                        setHealthSource(hs);
                        const isFresh = (data.supplements || []).length === 0
                            && (data.bodyComposition || []).length === 0
                            && (data.exerciseChart || []).length === 0;
                        if (isFresh) data = mergeHealthIntoData(data, hs);
                    }
                }

                const loaded = {
                    title: chart.title || '',
                    assessmentDate: chart.assessmentDate || '',
                    primaryGoal: chart.primaryGoal || '',
                    status: chart.status || 'draft',
                    data
                };
                setForm(loaded);

                // Offer a local draft only when it is newer than the saved chart
                // and actually differs — otherwise it is just noise.
                const draft = readDraft(chartId);
                if (draft && new Date(draft.savedAt) > new Date(chart.updatedAt || 0)
                    && JSON.stringify(draft.form) !== JSON.stringify(loaded)) {
                    setDraftOffer(draft);
                } else if (draft) {
                    clearDraft(chartId);
                }
            } catch (e) {
                addToast(e.response?.data?.error || 'Failed to load diet chart', 'error');
                onBack?.();
            } finally {
                setLoading(false);
            }
        })();
        /* eslint-disable-next-line */
    }, [chartId]);

    // Any edit clears the outstanding error list, so a fixed field's red badge
    // doesn't linger until the next save attempt. The next Save re-validates.
    const touch = () => { setDirty(true); setErrors((e) => (e.length ? [] : e)); };

    // Mirror the form to local storage while it is dirty, debounced so typing
    // doesn't hit storage on every keystroke.
    useEffect(() => {
        if (!dirty || !form) return;
        const t = setTimeout(() => writeDraft(chartId, form), 800);
        return () => clearTimeout(t);
    }, [form, dirty, chartId]);
    const setTop = (key, val) => { touch(); setForm((f) => ({ ...f, [key]: val })); };
    const setData = useCallback((key, val) => { touch(); setForm((f) => ({ ...f, data: { ...f.data, [key]: val } })); }, []);
    const setObj = (objKey, field, val) => { touch(); setForm((f) => ({ ...f, data: { ...f.data, [objKey]: { ...(f.data[objKey] || {}), [field]: val } } })); };

    // --- Section open/close + rail navigation ---------------------------------
    const toggleSection = (id) => setOpenIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const openSection = (id) => setOpenIds((prev) => new Set(prev).add(id));
    const jumpToSection = (id) => {
        openSection(id);
        requestAnimationFrame(() => {
            document.getElementById(`dcs-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };
    const expandAll = () => setOpenIds(new Set(SECTIONS.map((x) => x.id)));
    const collapseAll = () => setOpenIds(new Set());

    // ── Validation & cleanup ────────────────────────────────────────────────
    const isBlank = (v) => v == null || String(v).trim() === '';
    const isNum = (v) => isBlank(v) || !Number.isNaN(Number(v));
    // A table row counts as "filled" if any cell has a value.
    const rowFilled = (r) => Object.values(r || {}).some((v) => !isBlank(v));
    const cleanRows = (rows = []) => rows.filter(rowFilled);

    // Each problem carries the section that holds it, so the summary can send the
    // dietician straight there. The messages themselves are unchanged; what is
    // new is that they now point somewhere.
    const validate = (data) => {
        const errs = [];
        const add = (section, message) => errs.push({ section, message });

        if (isBlank(form.title)) add(1, 'Chart title is required.');

        // Numeric fields
        const numChecks = [
            [1, data.personalInfo, [['Age', 'age'], ['Height', 'height'], ['Weight', 'weight'], ['BMI', 'bmi'], ['Waist', 'waist'], ['Hip', 'hip']]],
            [11, data.nutritionGoals, [['Target weight', 'targetWeight'], ['Target body fat', 'targetBodyFat'], ['Target protein', 'targetProtein'], ['Target water', 'targetWater']]],
            [12, data.mealSpec, [['Daily calories', 'calories'], ['Daily protein', 'protein'], ['Daily carbs', 'carbs'], ['Daily fat', 'fat'], ['Daily fiber', 'fiber'], ['Daily water', 'water']]]
        ];
        numChecks.forEach(([section, obj, fields]) => fields.forEach(([label, k]) => {
            if (!isNum(obj?.[k])) add(section, `${label} must be a number.`);
        }));

        // Table rows: a filled row must have its type/category selected.
        const tableChecks = [
            [2, data.bodyComposition, 'parameter', 'Body composition'],
            [3, data.biochemical, 'investigation', 'Biochemical report'],
            [4, data.familyHistory, 'condition', 'Family history'],
            [5, data.exerciseChart, 'day', 'Exercise chart'],
            [14, data.followUp, 'parameter', 'Follow-up']
        ];
        tableChecks.forEach(([section, rows, key, label]) => (rows || []).forEach((r, i) => {
            if (rowFilled(r) && isBlank(r[key])) add(section, `${label}: choose a type for row ${i + 1}.`);
        }));

        // Meal plan: a meal with any food/note content must have a meal type.
        (data.mealPlan || []).forEach((m, i) => {
            const hasContent = (m.options || []).some((o) =>
                (o.items || []).some((it) => !isBlank(it.food) || it.calories != null || it.protein != null) || !isBlank(o.note));
            if (hasContent && isBlank(m.mealType)) add(12, `Meal ${i + 1}: select a meal type.`);
        });

        return errs;
    };

    // Strip empty rows / meals so blank "add" rows never persist.
    const cleanData = (data) => ({
        ...data,
        bodyComposition: cleanRows(data.bodyComposition),
        biochemical: cleanRows(data.biochemical),
        familyHistory: cleanRows(data.familyHistory),
        exerciseChart: cleanRows(data.exerciseChart),
        followUp: cleanRows(data.followUp),
        medications: cleanRows(data.medications),
        supplements: cleanRows(data.supplements),
        dietRecall: cleanRows(data.dietRecall),
        dietTracker: cleanRows(data.dietTracker),
        mealPlan: (data.mealPlan || []).filter((m) => {
            const hasContent = (m.options || []).some((o) =>
                (o.items || []).some((it) => !isBlank(it.food) || it.calories != null || it.protein != null) || !isBlank(o.note));
            return hasContent || !isBlank(m.mealType) || !isBlank(m.time);
        })
    });

    const handleSyncHealth = () => {
        if (!healthSource) return addToast('No health-profile data found for this member.', 'info');
        touch();
        setForm((f) => ({ ...f, data: mergeHealthIntoData(f.data, healthSource) }));
        addToast('Synced from health profile', 'success');
    };

    const handleSave = async () => {
        const errs = validate(form.data);
        if (errs.length) {
            setErrors(errs);
            // Reveal every section that has a problem, and take the dietician to
            // the first one — rather than printing a list at the top of the page
            // that names fields hidden inside collapsed panels.
            setOpenIds((prev) => {
                const next = new Set(prev);
                errs.forEach((e) => next.add(e.section));
                return next;
            });
            addToast(errs[0].message, 'error');
            requestAnimationFrame(() => {
                document.getElementById(`dcs-${errs[0].section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
        }
        setErrors([]);
        setSaving(true);
        try {
            await dieticianApi.updateChart(chartId, {
                title: form.title.trim(),
                assessmentDate: form.assessmentDate || null,
                primaryGoal: form.primaryGoal || null,
                status: form.status,
                data: cleanData(form.data)
            });
            setDirty(false);
            clearDraft(chartId);
            addToast('Diet chart saved', 'success');
            onBack?.();
        } catch (e) {
            addToast(e.response?.data?.error || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Back used to discard everything without a word.
    const handleBack = () => {
        if (dirty && !window.confirm('You have unsaved changes to this diet chart. Leave without saving?')) return;
        clearDraft(chartId);
        onBack?.();
    };

    if (loading || !form) {
        return <div className="loader-container" style={{ minHeight: 260 }}><div className="loader-icon" /></div>;
    }

    // Errors grouped by the section that holds them — feeds both the rail's
    // counts and each panel's own badge.
    const errorsBySection = errors.reduce((acc, e) => {
        (acc[e.section] = acc[e.section] || []).push(e.message);
        return acc;
    }, {});

    const sectionProps = (id) => ({
        open: openIds.has(id),
        onToggle: () => toggleSection(id),
        errorCount: (errorsBySection[id] || []).length
    });

    const filledCount = SECTIONS.filter((sec) => sec.filled(form.data)).length;

    // Moving a chart to Active is what publishes it to the member, so it asks
    // first instead of happening silently on a dropdown change.
    const handleStatusChange = (next) => {
        if (next === 'active' && form.status !== 'active') {
            if (!window.confirm(`Publish this diet chart to ${clientName || 'the member'}? They will see it in their app.`)) return;
        }
        setTop('status', next);
    };

    const pi = form.data.personalInfo;
    const mh = form.data.medicalHistory;
    const dp = form.data.dietaryPreferences;
    const drs = form.data.dietRecallSummary;
    const ng = form.data.nutritionGoals;
    const ms = form.data.mealSpec;
    const act = form.data.activitySummary;

    // ── Meal plan: meals → up to 5 options → food-item combinations ─────────
    const mealPlan = form.data.mealPlan;
    const setMeals = (meals) => setData('mealPlan', meals);
    const optionsOf = (m) => (Array.isArray(m.options) ? m.options : []);
    const mealsUpdate = (mi, fn) => setMeals(mealPlan.map((m, i) => (i === mi ? fn(m) : m)));
    const optionsUpdate = (mi, oi, fn) =>
        mealsUpdate(mi, (m) => ({ ...m, options: optionsOf(m).map((o, i) => (i === oi ? fn(o) : o)) }));

    const addMeal = () => setMeals([...mealPlan, { time: '', mealType: '', options: [emptyOption()] }]);
    const removeMeal = (mi) => setMeals(mealPlan.filter((_, i) => i !== mi));
    const patchMeal = (mi, patch) => mealsUpdate(mi, (m) => ({ ...m, ...patch }));

    const addOption = (mi) => {
        const count = optionsOf(mealPlan[mi] || {}).length;
        if (count >= MAX_OPTIONS) return;
        setOpenOpts((prev) => new Set(prev).add(optKey(mi, count)));
        mealsUpdate(mi, (m) => ({ ...m, options: [...optionsOf(m), emptyOption()] }));
    };
    const removeOption = (mi, oi) => mealsUpdate(mi, (m) => ({ ...m, options: optionsOf(m).filter((_, i) => i !== oi) }));
    const patchOption = (mi, oi, patch) => optionsUpdate(mi, oi, (o) => ({ ...o, ...patch }));

    const itemsOf = (o) => (Array.isArray(o.items) ? o.items : []);
    const addItem = (mi, oi) => optionsUpdate(mi, oi, (o) => ({ ...o, items: [...itemsOf(o), {}] }));
    const removeItem = (mi, oi, ii) => optionsUpdate(mi, oi, (o) => ({ ...o, items: itemsOf(o).filter((_, j) => j !== ii) }));
    const patchItem = (mi, oi, ii, patch) =>
        optionsUpdate(mi, oi, (o) => ({ ...o, items: itemsOf(o).map((it, j) => (j === ii ? { ...it, ...patch } : it)) }));

    // Type-or-pick food entry: an exact Food-DB name match autofills macros;
    // anything else is free text (foods are always optional).
    const setItemFood = (mi, oi, ii, value) => {
        const match = foods.find((f) => f.name.toLowerCase() === value.trim().toLowerCase());
        patchItem(mi, oi, ii, match
            ? { food: value, calories: match.calories, protein: match.protein, foodId: match.id }
            : { food: value, foodId: undefined });
    };

    const optKey = (mi, oi) => `${mi}:${oi}`;
    const isOptOpen = (mi, oi) => oi === 0 || openOpts.has(optKey(mi, oi));
    const toggleOpt = (mi, oi) => setOpenOpts((prev) => {
        const next = new Set(prev);
        const k = optKey(mi, oi);
        next.has(k) ? next.delete(k) : next.add(k);
        return next;
    });

    const optionTotals = (o) => itemsOf(o).reduce(
        (a, it) => ({ cal: a.cal + (parseFloat(it.calories) || 0), pro: a.pro + (parseFloat(it.protein) || 0) }),
        { cal: 0, pro: 0 }
    );

    return (
        <div>
            {/* Sticky header */}
            <div className="card" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1.1rem', marginBottom: '1.1rem', flexWrap: 'wrap', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <button className="icon-btn" onClick={handleBack} title="Back"><ArrowLeft size={18} /></button>
                    <div style={{
                        width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--primary), #34D399)', color: '#fff', fontWeight: 800, fontSize: '0.9rem'
                    }}>{initials(clientName)}</div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientName}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{readOnly ? 'View / edit health info' : 'Diet chart builder'}</span>
                            <span style={{ color: 'var(--border-color)' }}>·</span>
                            <span>{filledCount} of {SECTIONS.length} sections filled</span>
                            {dirty && <span style={{ color: 'var(--warning, #F59E0B)', fontWeight: 600 }}>Unsaved changes</span>}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {clientId && (
                        <a className="btn btn-secondary" href={`/clients/${clientId}/health`}
                            title="Open this member's health profile, workout schedule and history">
                            <HeartPulse size={15} /> Health profile
                        </a>
                    )}
                    {healthSource && (
                        <button className="btn btn-secondary" onClick={handleSyncHealth} title="Pull metrics, body composition, supplements and the trainer's workout week from the member's health profile">
                            <RefreshCw size={15} /> Sync health profile
                        </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0.7rem 0 0.5rem', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-body)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_TONE[form.status] || 'var(--text-muted)', flexShrink: 0 }} />
                        <select value={form.status} onChange={(e) => handleStatusChange(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem', padding: '0.5rem 0', cursor: 'pointer' }}>
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={17} /> {saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>

            {draftOffer && (
                <div style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap',
                    background: 'var(--bg-hover)', border: '1px solid var(--warning, #F59E0B)',
                    borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.85rem'
                }}>
                    <RefreshCw size={15} style={{ marginTop: 2, flexShrink: 0, color: 'var(--warning, #F59E0B)' }} />
                    <span style={{ flex: 1, minWidth: 200, color: 'var(--text-secondary)' }}>
                        Unsaved changes from {new Date(draftOffer.savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} were
                        recovered from this browser. They were never saved to the server.
                    </span>
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
                            onClick={() => { clearDraft(chartId); setDraftOffer(null); }}>
                            Discard
                        </button>
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
                            onClick={() => { setForm(draftOffer.form); setDirty(true); setDraftOffer(null); }}>
                            Restore them
                        </button>
                    </span>
                </div>
            )}

            {readOnly && (
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <Lock size={15} style={{ marginTop: 2, flexShrink: 0, color: 'var(--primary)' }} />
                    <span>You can update the assessment / health-info sections. The diet-plan sections (goals, meal plan, specifications, guidelines) are authored by the dietician and are read-only here.</span>
                </div>
            )}

            {errors.length > 0 && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger-text)', marginBottom: '0.4rem' }}>
                        <AlertCircle size={16} /> Please fix {errors.length} {errors.length === 1 ? 'issue' : 'issues'} before saving
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--danger-text)', fontSize: '0.82rem' }}>
                        {errors.slice(0, 8).map((e, i) => {
                            const sec = SECTIONS.find((x) => x.id === e.section);
                            return (
                                <li key={i}>
                                    <button type="button" onClick={() => jumpToSection(e.section)}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left', textDecoration: 'underline dotted' }}>
                                        {e.message} <span style={{ opacity: 0.75 }}>— {String(e.section).padStart(2, '0')} {sec?.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                        {errors.length > 8 && <li>…and {errors.length - 8} more.</li>}
                    </ul>
                </div>
            )}

            <div className="dcb-layout">
            <aside className="dcb-rail">
                <SectionRail
                    data={form.data}
                    openIds={openIds}
                    errorsBySection={errorsBySection}
                    onJump={jumpToSection}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}
                />
            </aside>

            <div className="dcb-main">
            {/* Chart meta */}
            <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: '0.9rem' }}>
                <Row>
                    <Field label="Chart title *" size="lg">
                        <input className="input-field" value={form.title} onChange={(e) => setTop('title', e.target.value)} placeholder="e.g. Initial Assessment & Plan"
                            style={errors.length && !form.title.trim() ? { borderColor: 'var(--danger)' } : undefined} />
                    </Field>
                    <Field label="Date of assessment" size="sm"><input type="date" className="input-field" value={form.assessmentDate || ''} onChange={(e) => setTop('assessmentDate', e.target.value)} /></Field>
                    <Field label="Primary goal" size="md">
                        <select className="input-field" value={form.primaryGoal || ''} onChange={(e) => setTop('primaryGoal', e.target.value)}>
                            <option value="">—</option>
                            {GOALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </Field>
                </Row>
            </div>

            {/* 1. Personal Information */}
            <Section id={1} {...sectionProps(1)}>
                <Row>
                    <Field label="Name" size="lg"><input className="input-field" value={pi.name || ''} onChange={(e) => setObj('personalInfo', 'name', e.target.value)} placeholder="Full name" /></Field>
                    <Field label="Age" size="xs"><input type="number" min="0" className="input-field" value={pi.age || ''} onChange={(e) => setObj('personalInfo', 'age', e.target.value)} /></Field>
                    <Field label="Gender" size="sm">
                        <select className="input-field" value={pi.gender || ''} onChange={(e) => setObj('personalInfo', 'gender', e.target.value)}>
                            <option value="">—</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </Field>
                    <Field label="Date of Birth" size="sm"><input type="date" className="input-field" value={pi.dob || ''} onChange={(e) => setObj('personalInfo', 'dob', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Contact No." size="md"><input className="input-field" value={pi.contact || ''} onChange={(e) => setObj('personalInfo', 'contact', e.target.value)} placeholder="Phone" /></Field>
                    <Field label="Occupation" size="md"><input className="input-field" value={pi.occupation || ''} onChange={(e) => setObj('personalInfo', 'occupation', e.target.value)} /></Field>
                    <Field label="Height (cm)" size="sm"><input type="number" min="0" className="input-field" value={pi.height || ''} onChange={(e) => setObj('personalInfo', 'height', e.target.value)} /></Field>
                    <Field label="Weight (kg)" size="sm"><input type="number" min="0" className="input-field" value={pi.weight || ''} onChange={(e) => setObj('personalInfo', 'weight', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="BMI" size="xs"><input type="number" min="0" step="0.1" className="input-field" value={pi.bmi || ''} onChange={(e) => setObj('personalInfo', 'bmi', e.target.value)} /></Field>
                    <Field label="Waist (cm)" size="sm"><input type="number" min="0" className="input-field" value={pi.waist || ''} onChange={(e) => setObj('personalInfo', 'waist', e.target.value)} /></Field>
                    <Field label="Hip (cm)" size="sm"><input type="number" min="0" className="input-field" value={pi.hip || ''} onChange={(e) => setObj('personalInfo', 'hip', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 2. Body Composition */}
            <Section id={2} {...sectionProps(2)}>
                <RepeatTable
                    columns={[
                        { key: 'parameter', label: 'Parameter', options: PRESET.bodyComposition },
                        { key: 'current', label: 'Current Value' },
                        { key: 'reference', label: 'Reference/Goal' },
                        { key: 'remarks', label: 'Remarks', width: 200 }
                    ]}
                    rows={form.data.bodyComposition} onChange={(r) => setData('bodyComposition', r)} addLabel="Add parameter" />
                <Field label="Interpretation" full>
                    <textarea className="input-field" rows="2" style={{ marginTop: '0.75rem' }} value={form.data.bodyCompositionNotes} onChange={(e) => setData('bodyCompositionNotes', e.target.value)} />
                </Field>
            </Section>

            {/* 3. Biochemical */}
            <Section id={3} {...sectionProps(3)}>
                <RepeatTable
                    columns={[
                        { key: 'investigation', label: 'Investigation', options: PRESET.biochemical },
                        { key: 'result', label: 'Result' },
                        { key: 'referenceRange', label: 'Reference Range' },
                        { key: 'remarks', label: 'Remarks', width: 200 }
                    ]}
                    rows={form.data.biochemical} onChange={(r) => setData('biochemical', r)} addLabel="Add investigation" />
            </Section>

            {/* 4. Medical & Family History */}
            <Section id={4} {...sectionProps(4)}>
                <Row>
                    <Field label="Present medical conditions" full><textarea className="input-field" rows="2" value={mh.present || ''} onChange={(e) => setObj('medicalHistory', 'present', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Previous medical conditions" full><textarea className="input-field" rows="2" value={mh.previous || ''} onChange={(e) => setObj('medicalHistory', 'previous', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Recent surgeries / hospitalization" size="lg"><textarea className="input-field" rows="2" value={mh.surgeries || ''} onChange={(e) => setObj('medicalHistory', 'surgeries', e.target.value)} /></Field>
                    <Field label="Food-related symptoms" size="lg"><textarea className="input-field" rows="2" value={mh.foodSymptoms || ''} onChange={(e) => setObj('medicalHistory', 'foodSymptoms', e.target.value)} /></Field>
                    <Field label="Digestive / GI complaints" size="lg"><textarea className="input-field" rows="2" value={mh.giComplaints || ''} onChange={(e) => setObj('medicalHistory', 'giComplaints', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Sleep pattern"><input className="input-field" value={mh.sleep || ''} onChange={(e) => setObj('medicalHistory', 'sleep', e.target.value)} /></Field>
                    <Field label="Stress level"><input className="input-field" value={mh.stress || ''} onChange={(e) => setObj('medicalHistory', 'stress', e.target.value)} /></Field>
                    <Field label="Other relevant history"><input className="input-field" value={mh.other || ''} onChange={(e) => setObj('medicalHistory', 'other', e.target.value)} /></Field>
                </Row>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0.5rem 0' }}>Family History</div>
                <RepeatTable
                    columns={[
                        { key: 'condition', label: 'Condition', options: PRESET.familyHistory },
                        { key: 'self', label: 'Self' },
                        { key: 'father', label: 'Father' },
                        { key: 'mother', label: 'Mother' },
                        { key: 'siblings', label: 'Siblings' },
                        { key: 'remarks', label: 'Remarks', width: 180 }
                    ]}
                    rows={form.data.familyHistory} onChange={(r) => setData('familyHistory', r)} addLabel="Add condition" />
            </Section>

            {/* 5. Exercise / Physical Activity */}
            <Section id={5} {...sectionProps(5)}>
                <RepeatTable
                    columns={[
                        { key: 'day', label: 'Day', options: PRESET.days },
                        { key: 'activity', label: 'Exercise/Activity' },
                        { key: 'duration', label: 'Duration' },
                        { key: 'intensity', label: 'Intensity' },
                        { key: 'steps', label: 'Steps' },
                        { key: 'remarks', label: 'Remarks', width: 160 }
                    ]}
                    rows={form.data.exerciseChart} onChange={(r) => setData('exerciseChart', r)} addLabel="Add day" />
                <Row>
                    <Field label="Average daily activity"><input className="input-field" value={act.averageDaily || ''} onChange={(e) => setObj('activitySummary', 'averageDaily', e.target.value)} /></Field>
                    <Field label="Workout goal"><input className="input-field" value={act.workoutGoal || ''} onChange={(e) => setObj('activitySummary', 'workoutGoal', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 6. Medication */}
            <Section id={6} {...sectionProps(6)}>
                <RepeatTable
                    columns={[
                        { key: 'medication', label: 'Medication' },
                        { key: 'dose', label: 'Dose' },
                        { key: 'frequency', label: 'Frequency' },
                        { key: 'timing', label: 'Timing' },
                        { key: 'reason', label: 'Reason/Condition', width: 180 }
                    ]}
                    rows={form.data.medications} onChange={(r) => setData('medications', r)} addLabel="Add medication" />
            </Section>

            {/* 7. Supplements */}
            <Section id={7} {...sectionProps(7)}>
                <RepeatTable
                    columns={[
                        { key: 'supplement', label: 'Supplement' },
                        { key: 'brand', label: 'Brand' },
                        { key: 'dose', label: 'Dose' },
                        { key: 'timing', label: 'Timing' },
                        { key: 'purpose', label: 'Purpose' },
                        { key: 'prescribedBy', label: 'Prescribed By' }
                    ]}
                    rows={form.data.supplements} onChange={(r) => setData('supplements', r)} addLabel="Add supplement" />
            </Section>

            {/* 8. Dietary Preferences */}
            <Section id={8} {...sectionProps(8)}>
                <Row>
                    <Field label="Diet type">
                        <select className="input-field" value={dp.dietType || ''} onChange={(e) => setObj('dietaryPreferences', 'dietType', e.target.value)}>
                            <option value="">—</option>
                            <option>Vegetarian</option><option>Eggetarian</option><option>Non-vegetarian</option><option>Vegan</option><option>Other</option>
                        </select>
                    </Field>
                    <Field label="Food allergies / intolerances"><input className="input-field" value={dp.allergies || ''} onChange={(e) => setObj('dietaryPreferences', 'allergies', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Food likes"><input className="input-field" value={dp.likes || ''} onChange={(e) => setObj('dietaryPreferences', 'likes', e.target.value)} /></Field>
                    <Field label="Food dislikes"><input className="input-field" value={dp.dislikes || ''} onChange={(e) => setObj('dietaryPreferences', 'dislikes', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Foods avoided"><input className="input-field" value={dp.avoided || ''} onChange={(e) => setObj('dietaryPreferences', 'avoided', e.target.value)} /></Field>
                    <Field label="Religious / cultural restrictions"><input className="input-field" value={dp.restrictions || ''} onChange={(e) => setObj('dietaryPreferences', 'restrictions', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 9. Diet Recall */}
            <Section id={9} {...sectionProps(9)}>
                <RepeatTable
                    columns={[
                        { key: 'time', label: 'Time' },
                        { key: 'food', label: 'Meal/Food & Quantity', width: 220 },
                        { key: 'method', label: 'Preparation' },
                        { key: 'calories', label: 'Est. Calories', type: 'number' },
                        { key: 'protein', label: 'Protein', type: 'number' },
                        { key: 'remarks', label: 'Remarks' }
                    ]}
                    rows={form.data.dietRecall} onChange={(r) => setData('dietRecall', r)} addLabel="Add entry" />
                <Row>
                    <Field label="Total energy (kcal/day)"><input className="input-field" value={drs.energy || ''} onChange={(e) => setObj('dietRecallSummary', 'energy', e.target.value)} /></Field>
                    <Field label="Protein (g/day)"><input className="input-field" value={drs.protein || ''} onChange={(e) => setObj('dietRecallSummary', 'protein', e.target.value)} /></Field>
                    <Field label="Water (L/day)"><input className="input-field" value={drs.water || ''} onChange={(e) => setObj('dietRecallSummary', 'water', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Fruit & vegetable intake"><input className="input-field" value={drs.fruitVeg || ''} onChange={(e) => setObj('dietRecallSummary', 'fruitVeg', e.target.value)} /></Field>
                    <Field label="Eating pattern"><input className="input-field" value={drs.pattern || ''} onChange={(e) => setObj('dietRecallSummary', 'pattern', e.target.value)} /></Field>
                    <Field label="Major nutritional gaps"><input className="input-field" value={drs.gaps || ''} onChange={(e) => setObj('dietRecallSummary', 'gaps', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 10. Diet Tracker */}
            <Section id={10} {...sectionProps(10)}>
                <RepeatTable
                    columns={[
                        { key: 'date', label: 'Date' },
                        { key: 'breakfast', label: 'Breakfast' },
                        { key: 'midMorning', label: 'Mid-morning' },
                        { key: 'lunch', label: 'Lunch' },
                        { key: 'eveningSnack', label: 'Evening Snack' },
                        { key: 'dinner', label: 'Dinner' },
                        { key: 'water', label: 'Water' },
                        { key: 'exercise', label: 'Exercise' },
                        { key: 'remarks', label: 'Remarks' }
                    ]}
                    rows={form.data.dietTracker} onChange={(r) => setData('dietTracker', r)} addLabel="Add day" />
            </Section>

            {/* 11. Nutrition Goals (dietician only) */}
            <Section id={11} {...sectionProps(11)}>
                <Row>
                    <Field label="Primary goal" full><textarea className="input-field" rows="2" disabled={planDisabled} value={ng.primary || ''} onChange={(e) => setObj('nutritionGoals', 'primary', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Secondary goal 1"><input className="input-field" disabled={planDisabled} value={ng.secondary1 || ''} onChange={(e) => setObj('nutritionGoals', 'secondary1', e.target.value)} /></Field>
                    <Field label="Secondary goal 2"><input className="input-field" disabled={planDisabled} value={ng.secondary2 || ''} onChange={(e) => setObj('nutritionGoals', 'secondary2', e.target.value)} /></Field>
                    <Field label="Secondary goal 3"><input className="input-field" disabled={planDisabled} value={ng.secondary3 || ''} onChange={(e) => setObj('nutritionGoals', 'secondary3', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Target weight (kg)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ng.targetWeight || ''} onChange={(e) => setObj('nutritionGoals', 'targetWeight', e.target.value)} /></Field>
                    <Field label="Target body fat (%)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ng.targetBodyFat || ''} onChange={(e) => setObj('nutritionGoals', 'targetBodyFat', e.target.value)} /></Field>
                    <Field label="Target protein (g/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ng.targetProtein || ''} onChange={(e) => setObj('nutritionGoals', 'targetProtein', e.target.value)} /></Field>
                    <Field label="Target water (L/day)" size="sm"><input type="number" min="0" step="0.1" className="input-field" disabled={planDisabled} value={ng.targetWater || ''} onChange={(e) => setObj('nutritionGoals', 'targetWater', e.target.value)} /></Field>
                    <Field label="Activity target" size="md"><input className="input-field" disabled={planDisabled} value={ng.activityTarget || ''} onChange={(e) => setObj('nutritionGoals', 'activityTarget', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 12. Individualized Diet Plan (dietician only) */}
            <Section id={12} subtitle="foods optional" {...sectionProps(12)}>
                {/* Shared food suggestions — the food cell is a type-or-pick combobox. */}
                <datalist id="dietchart-foods">
                    {foods.map((f) => (
                        <option key={f.id} value={f.name}>{`${f.servingSize}${f.servingUnit} · ${f.calories} kcal`}</option>
                    ))}
                </datalist>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem' }}>
                    Each meal can have up to {MAX_OPTIONS} interchangeable options; each option is a combination of foods the member can choose from.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {mealPlan.map((meal, mi) => {
                        const opts = optionsOf(meal);
                        return (
                            <div key={mi} style={mealCardStyle}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <Field label="Meal">
                                        <select className="input-field" disabled={planDisabled} value={meal.mealType || ''} onChange={(e) => patchMeal(mi, { mealType: e.target.value })}>
                                            <option value="">—</option>{PRESET.mealTypes.map((m) => <option key={m}>{m}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Time" size="sm"><input className="input-field" disabled={planDisabled} value={meal.time || ''} onChange={(e) => patchMeal(mi, { time: e.target.value })} placeholder="08:00" /></Field>
                                    {!planDisabled && (
                                        <button type="button" className="icon-btn" title="Remove meal" onClick={() => removeMeal(mi)} style={{ color: 'var(--danger)', marginBottom: 2 }}><Trash2 size={16} /></button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.85rem' }}>
                                    {opts.map((opt, oi) => {
                                        const totals = optionTotals(opt);
                                        const totalLabel = [
                                            totals.cal > 0 ? `${Math.round(totals.cal)} kcal` : null,
                                            totals.pro > 0 ? `${Math.round(totals.pro)} g protein` : null
                                        ].filter(Boolean).join(' · ');
                                        const foodNames = itemsOf(opt).map((it) => it.food).filter(Boolean);
                                        const summary = foodNames.length
                                            ? `${foodNames.length} food${foodNames.length === 1 ? '' : 's'} · ${foodNames.slice(0, 3).join(', ')}${foodNames.length > 3 ? '…' : ''}`
                                            : 'Empty';
                                        const expanded = isOptOpen(mi, oi);
                                        return (
                                            <div key={oi} style={optionCardStyle}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '0.5rem' : 0, gap: '0.5rem' }}>
                                                    <button type="button" onClick={() => oi !== 0 && toggleOpt(mi, oi)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0,
                                                            cursor: oi === 0 ? 'default' : 'pointer', font: 'inherit', minWidth: 0, flex: 1, textAlign: 'left'
                                                        }}>
                                                        {oi !== 0 && (
                                                            <ChevronDown size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                                                        )}
                                                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', flexShrink: 0 }}>Option {oi + 1}</span>
                                                        {!expanded && (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {summary}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                                        {totalLabel && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{totalLabel}</span>}
                                                        {!planDisabled && opts.length > 1 && (
                                                            <button type="button" className="icon-btn" title="Remove option" onClick={() => removeOption(mi, oi)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                                {expanded && <>
                                                {itemsOf(opt).map((it, ii) => (
                                                    <div key={ii} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                                                        <input className="input-field" list="dietchart-foods" style={{ ...cellInput, flex: 2, minWidth: 150 }} disabled={planDisabled} value={it.food || ''} onChange={(e) => setItemFood(mi, oi, ii, e.target.value)} placeholder="Type a food or pick (optional)" />
                                                        <input className="input-field" type="number" style={{ ...cellInput, width: 84, minWidth: 70 }} disabled={planDisabled} value={it.calories ?? ''} onChange={(e) => patchItem(mi, oi, ii, { calories: e.target.value === '' ? null : parseFloat(e.target.value) })} placeholder="kcal" />
                                                        <input className="input-field" type="number" style={{ ...cellInput, width: 84, minWidth: 70 }} disabled={planDisabled} value={it.protein ?? ''} onChange={(e) => patchItem(mi, oi, ii, { protein: e.target.value === '' ? null : parseFloat(e.target.value) })} placeholder="protein" />
                                                        {!planDisabled && (
                                                            <button type="button" className="icon-btn" title="Remove food" disabled={itemsOf(opt).length <= 1} onClick={() => removeItem(mi, oi, ii)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                                        )}
                                                    </div>
                                                ))}
                                                {!planDisabled && (
                                                    <button type="button" className="btn btn-secondary" onClick={() => addItem(mi, oi)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', marginTop: '0.2rem' }}><Plus size={13} /> Add food</button>
                                                )}
                                                {(!planDisabled || opt.note) && (
                                                    <input className="input-field" style={{ ...cellInput, marginTop: '0.55rem' }} disabled={planDisabled} value={opt.note || ''} onChange={(e) => patchOption(mi, oi, { note: e.target.value })} placeholder="Note / specifications (optional)" />
                                                )}
                                                </>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {!planDisabled && opts.length < MAX_OPTIONS && (
                                    <button type="button" className="btn btn-secondary" onClick={() => addOption(mi)} style={{ marginTop: '0.75rem', padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}>
                                        <Plus size={14} /> Add option ({opts.length}/{MAX_OPTIONS})
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {mealPlan.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No meals yet.</p>}
                </div>
                {!planDisabled && (
                    <button type="button" className="btn btn-secondary" onClick={addMeal} style={{ marginTop: '0.85rem', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                        <Utensils size={15} /> Add meal
                    </button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', margin: '1.25rem 0 0.6rem' }}>
                    <Target size={15} color="var(--primary)" /> Daily targets
                </div>
                <Row>
                    <Field label="Calories (kcal/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ms.calories || ''} onChange={(e) => setObj('mealSpec', 'calories', e.target.value)} /></Field>
                    <Field label="Protein (g/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ms.protein || ''} onChange={(e) => setObj('mealSpec', 'protein', e.target.value)} /></Field>
                    <Field label="Carbohydrate (g/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ms.carbs || ''} onChange={(e) => setObj('mealSpec', 'carbs', e.target.value)} /></Field>
                    <Field label="Fat (g/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ms.fat || ''} onChange={(e) => setObj('mealSpec', 'fat', e.target.value)} /></Field>
                    <Field label="Fiber (g/day)" size="sm"><input type="number" min="0" className="input-field" disabled={planDisabled} value={ms.fiber || ''} onChange={(e) => setObj('mealSpec', 'fiber', e.target.value)} /></Field>
                    <Field label="Water (L/day)" size="sm"><input type="number" min="0" step="0.1" className="input-field" disabled={planDisabled} value={ms.water || ''} onChange={(e) => setObj('mealSpec', 'water', e.target.value)} /></Field>
                </Row>
            </Section>

            {/* 13. General Guidelines (dietician only) */}
            <Section id={13} {...sectionProps(13)}>
                <Row>
                    <Field label="Food guidelines (one per line)"><textarea className="input-field" rows="5" disabled={planDisabled} value={(form.data.guidelines.food || []).join('\n')} onChange={(e) => setData('guidelines', { ...form.data.guidelines, food: e.target.value.split('\n') })} /></Field>
                    <Field label="Lifestyle guidelines (one per line)"><textarea className="input-field" rows="5" disabled={planDisabled} value={(form.data.guidelines.lifestyle || []).join('\n')} onChange={(e) => setData('guidelines', { ...form.data.guidelines, lifestyle: e.target.value.split('\n') })} /></Field>
                </Row>
            </Section>

            {/* 14. Follow-up & Monitoring */}
            <Section id={14} {...sectionProps(14)}>
                <RepeatTable
                    columns={[
                        { key: 'parameter', label: 'Parameter', options: PRESET.followUp },
                        { key: 'baseline', label: 'Baseline' },
                        { key: 'f1', label: 'Follow-up 1' },
                        { key: 'f2', label: 'Follow-up 2' },
                        { key: 'f3', label: 'Follow-up 3' }
                    ]}
                    rows={form.data.followUp} onChange={(r) => setData('followUp', r)} addLabel="Add parameter" />
                <Row>
                    <Field label="Dietitian's remarks" full><textarea className="input-field" rows="3" value={form.data.dietitianRemarks} onChange={(e) => setData('dietitianRemarks', e.target.value)} /></Field>
                </Row>
                <Row>
                    <Field label="Next follow-up date" size="sm"><input type="date" className="input-field" value={form.data.nextFollowUpDate || ''} onChange={(e) => setData('nextFollowUpDate', e.target.value)} /></Field>
                </Row>
            </Section>

            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.25rem', margin: '1.25rem 0 3rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Changes are saved to <b style={{ color: 'var(--text-main)' }}>{clientName}</b>'s diet chart.
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={handleBack}>Back</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={17} /> {saving ? 'Saving…' : 'Save Diet Chart'}</button>
                </div>
            </div>
            </div>
            </div>

            <style>{`
                .dcb-layout { display: grid; grid-template-columns: 244px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
                .dcb-rail { position: sticky; top: 88px; max-height: calc(100vh - 108px); overflow-y: auto; }
                .dcb-main { min-width: 0; }
                @media (max-width: 1024px) {
                    .dcb-layout { grid-template-columns: minmax(0, 1fr); }
                    .dcb-rail { position: static; max-height: none; margin-bottom: 0.5rem; }
                }
            `}</style>
        </div>
    );
};

export default DietChartBuilder;
