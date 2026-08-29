import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { dieticianApi } from '../../../api/dietician';
import { Search, FileText, Trash2, Eye, User, Users, CheckCircle2, ChevronRight, Loader } from 'lucide-react';
import DietChartBuilder from './DietChartBuilder';

const GOAL_LABEL = {
    weight_loss: 'Weight Loss', weight_gain: 'Weight Gain', maintenance: 'Maintenance',
    muscle_gain: 'Muscle Gain', performance: 'Performance', therapeutic: 'Therapeutic'
};
const STATUS_BADGE = { draft: 'badge-warning', active: 'badge-success', archived: 'badge-info' };

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

const DietChartsPanel = () => {
    const { user, facilitySubscription } = useAuth();
    const { addToast, showConfirm } = useToast();
    const facilityId = facilitySubscription?.id;
    const isDietician = user?.role === 'dietician';

    const [charts, setCharts] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [openChartId, setOpenChartId] = useState(null); // chart open in the builder
    const [busyClientId, setBusyClientId] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const [ch, cl] = await Promise.all([
                dieticianApi.getCharts(facilityId),
                dieticianApi.getClients(facilityId)
            ]);
            setCharts(ch);
            setClients(cl);
        } catch (e) {
            addToast('Failed to load diet charts', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [facilityId]);

    // Latest chart per client + which clients have a finalized (active) plan.
    const latestChartByClient = {};
    charts.forEach((ch) => {
        const cur = latestChartByClient[ch.clientId];
        if (!cur || new Date(ch.updatedAt) > new Date(cur.updatedAt)) latestChartByClient[ch.clientId] = ch;
    });
    const activeClientIds = new Set(charts.filter((c) => c.status === 'active').map((c) => c.clientId));

    // Click a client card → open their latest chart, or create a fresh one.
    const openForClient = async (client) => {
        const existing = latestChartByClient[client.id];
        if (existing) { setOpenChartId(existing.id); return; }
        setBusyClientId(client.id);
        try {
            const chart = await dieticianApi.createChart({
                clientId: client.id,
                title: `Diet Plan — ${client.name || ''}`.trim(),
                status: 'draft',
                assessmentDate: new Date().toISOString().slice(0, 10),
                data: { personalInfo: { name: client.name || '', gender: client.gender || '', height: client.height || '', weight: client.weight || '' } }
            });
            await load();
            setOpenChartId(chart.id);
        } catch (e) {
            addToast(e.response?.data?.error || 'Failed to start diet plan', 'error');
        } finally {
            setBusyClientId(null);
        }
    };

    const handleDelete = (chart) => showConfirm(
        `Delete this diet chart for ${chart.Client?.name || 'this member'}?`,
        async () => {
            try { await dieticianApi.deleteChart(chart.id); addToast('Diet chart deleted', 'success'); load(); }
            catch (e) { addToast(e.response?.data?.error || 'Failed to delete', 'error'); }
        },
        'Delete Diet Chart'
    );

    if (openChartId) {
        return (
            <DietChartBuilder
                chartId={openChartId}
                facilityId={facilityId}
                readOnly={!isDietician}
                onBack={() => { setOpenChartId(null); load(); }}
            />
        );
    }

    // ── Dietician: client cards split into Assigned (to do) + Completed ──────
    if (isDietician) {
        const term = search.toLowerCase();
        const visible = clients.filter((c) => (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(search));
        const completed = visible.filter((c) => activeClientIds.has(c.id));
        const assigned = visible.filter((c) => !activeClientIds.has(c.id));

        const renderCard = (client) => {
            const chart = latestChartByClient[client.id];
            const done = activeClientIds.has(client.id);
            const status = done
                ? { label: 'Completed', cls: 'badge-success' }
                : (chart ? { label: 'In progress', cls: 'badge-warning' } : { label: 'Not started', cls: 'badge-info' });
            const action = done ? 'Open plan' : (chart ? 'Continue plan' : 'Create plan');
            const meta = [
                client.gender,
                client.height ? `${client.height} cm` : null,
                client.weight ? `${client.weight} kg` : null
            ].filter(Boolean).join(' · ');
            const busy = busyClientId === client.id;

            return (
                <button
                    key={client.id}
                    onClick={() => !busy && openForClient(client)}
                    disabled={busy}
                    className="card"
                    style={{
                        textAlign: 'left', cursor: busy ? 'wait' : 'pointer', padding: '1.25rem',
                        display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--border-color)',
                        width: '100%', font: 'inherit', color: 'inherit'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--primary), #34D399)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem'
                        }}>{initials(client.name)}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{client.phone || '—'}</div>
                        </div>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                    </div>

                    {meta && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textTransform: 'capitalize' }}>{meta}</div>}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {done && chart?.assessmentDate ? `Assessed ${chart.assessmentDate}` : (chart ? 'Draft in progress' : 'No plan yet')}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                            {busy ? <><Loader size={15} style={{ animation: 'spinner 0.8s linear infinite' }} /> Starting…</> : <>{action} <ChevronRight size={15} /></>}
                        </span>
                    </div>
                </button>
            );
        };

        const Section = ({ icon: Icon, title, list, empty }) => (
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <Icon size={18} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
                    <span style={{ background: 'var(--bg-hover)', borderRadius: 999, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{list.length}</span>
                </div>
                {list.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: '1.25rem', border: '1px dashed var(--border-color)', borderRadius: 12 }}>{empty}</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {list.map(renderCard)}
                    </div>
                )}
            </div>
        );

        return (
            <div>
                <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                    <div className="search-bar" style={{ maxWidth: 360 }}>
                        <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                        <input type="text" placeholder="Search your clients…" value={search} onChange={(e) => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                    </div>
                </div>

                {loading ? (
                    <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>
                ) : clients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <Users size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                        <p>No members are assigned to you yet. Ask an admin to assign members to you from the Staff / Dieticians section.</p>
                    </div>
                ) : (
                    <>
                        <Section
                            icon={Users}
                            title="Assigned Clients"
                            list={assigned}
                            empty="No pending clients — every assigned member has a completed plan."
                        />
                        <Section
                            icon={CheckCircle2}
                            title="Completed Clients"
                            list={completed}
                            empty="No completed plans yet. Open an assigned client and mark their plan Active when it's ready."
                        />
                    </>
                )}
            </div>
        );
    }

    // ── Admin / staff: read-only chart list ─────────────────────────────────
    const filtered = charts.filter((c) => {
        const matchesSearch = (c.Client?.name || c.title || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                    <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                    <input type="text" placeholder="Search by member…" value={search} onChange={(e) => setSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                </div>
                <select className="input-field" style={{ maxWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            {loading ? (
                <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {filtered.map((chart) => (
                        <div key={chart.id} className="card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                    <div style={{ padding: '0.5rem', borderRadius: 10, background: 'var(--bg-hover)', display: 'flex' }}><FileText size={18} color="var(--primary)" /></div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chart.Client?.name || 'Member'}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chart.title || 'Untitled chart'}</div>
                                    </div>
                                </div>
                                <span className={`badge ${STATUS_BADGE[chart.status] || 'badge-info'}`}>{chart.status}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                                {chart.primaryGoal && <span style={pill}>{GOAL_LABEL[chart.primaryGoal] || chart.primaryGoal}</span>}
                                {chart.assessmentDate && <span style={{ ...pill, background: 'transparent', color: 'var(--text-secondary)' }}>Assessed {chart.assessmentDate}</span>}
                            </div>

                            {chart.dietician && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <User size={13} /> {chart.dietician.name}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setOpenChartId(chart.id)}>
                                    <Eye size={16} /> View
                                </button>
                                <button className="icon-btn" title="Delete" onClick={() => handleDelete(chart)} style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            No diet charts yet. Dieticians create charts for the members assigned to them.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const pill = { background: 'var(--bg-hover)', color: 'var(--text-main)', padding: '3px 10px', borderRadius: 8, fontWeight: 600 };

export default DietChartsPanel;
