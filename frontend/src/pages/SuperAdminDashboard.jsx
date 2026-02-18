import React, { useEffect, useState } from 'react';
import api from '../api';
import { Users, AlertTriangle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState({ totalFacilities: 0, activeFacilities: 0, suspendedFacilities: 0, expiredFacilities: 0, mrr: 0 });
    const [expiringFacilities, setExpiringFacilities] = useState([]);
    const [blockedFacilities, setBlockedFacilities] = useState([]);
    const [autopayPayments, setAutopayPayments] = useState([]);
    const { addToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/superadmin/dashboard');
                // Ensure we map the response correctly if backend keys changed
                setStats(res.data.stats);
                setExpiringFacilities(res.data.expiringFacilities || []);
                setBlockedFacilities(res.data.blockedFacilities || []);
                setAutopayPayments(res.data.autopayPayments || []);
            } catch (err) {
                console.error(err);
                addToast('Failed to fetch dashboard data', 'error');
            }
        };
        fetchDashboard();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color, subtext, path }) => (
        <div
            className="card stat-card"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: path ? 'pointer' : 'default',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onClick={() => path && navigate(path)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 className="stat-title">{title}</h3>
                    <div className="stat-value">{value}</div>
                </div>
                <div className="stat-icon" style={{ background: `${color}20`, color: color }}>
                    <Icon size={24} />
                </div>
            </div>
            {subtext && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{subtext}</div>}
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Super Admin Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Platform Overview & Health</p>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <StatCard
                    title="Total Facilities"
                    value={stats.totalFacilities}
                    icon={Users}
                    color="var(--primary)"
                    path="/facilities"
                />
                <StatCard
                    title="Active Facilities"
                    value={stats.activeFacilities}
                    icon={CheckCircle}
                    color="var(--success)"
                    path="/facilities?status=active"
                />
                <StatCard
                    title="Suspended/Blocked"
                    value={stats.suspendedFacilities + stats.expiredFacilities}
                    icon={XCircle}
                    color="var(--danger)"
                    subtext={`${stats.expiredFacilities} Expired`}
                    path="/facilities?status=inactive"
                />
                <StatCard
                    title="Recurring Revenue"
                    value={`₹${stats.mrr.toLocaleString()}`}
                    icon={TrendingUp}
                    color="var(--success)"
                    subtext="Monthly Recurring Revenue"
                    path="/reports"
                />
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <XCircle size={20} color="var(--danger)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Blocked Facilities (AutoPay Stopped/Failed)</h3>
                </div>

                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Facility</th>
                                <th>Plan</th>
                                <th>Last Failure</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blockedFacilities.map((facility) => (
                                <tr key={facility.id}>
                                    <td style={{ paddingLeft: '2rem', fontWeight: '500' }}>{facility.name}</td>
                                    <td>{facility.SubscriptionPlan ? facility.SubscriptionPlan.name : 'N/A'}</td>
                                    <td style={{ color: 'var(--danger)' }}>{facility.lastAutopayFailureReason || 'AutoPay issue'}</td>
                                    <td>{formatDate(facility.updatedAt)}</td>
                                </tr>
                            ))}
                            {blockedFacilities.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                        No blocked facilities.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expiring Subscriptions */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertTriangle size={20} color="var(--accent-orange)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Expiring Subscriptions (Next 7 Days)</h3>
                </div>

                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Facility Name</th>
                                <th>Plan</th>
                                <th>Expiry Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringFacilities.map((facility, index) => (
                                <tr key={facility.id}>
                                    <td style={{ paddingLeft: '2rem', fontWeight: '500' }}>{facility.name}</td>
                                    <td>{facility.SubscriptionPlan ? facility.SubscriptionPlan.name : 'N/A'}</td>
                                    <td style={{ color: 'var(--danger)' }}>{formatDate(facility.subscriptionExpiresAt)}</td>
                                    <td>
                                        <span className="status-badge" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)' }}>
                                            Expiring Soon
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {expiringFacilities.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        No critical expiries found for the upcoming week.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card" style={{ padding: '0', overflow: 'hidden', marginTop: '2rem' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>AutoPay Payment Details (Latest)</h3>
                </div>

                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Facility</th>
                                <th>Event</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Payment ID</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {autopayPayments.map((item) => (
                                <tr key={item.id}>
                                    <td style={{ paddingLeft: '2rem', fontWeight: '500' }}>{item.Facility?.name || 'Unknown'}</td>
                                    <td>{item.eventType}</td>
                                    <td>{item.amount != null ? `₹${Number(item.amount).toFixed(2)}` : '-'}</td>
                                    <td>{item.status || '-'}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.razorpayPaymentId || '-'}</td>
                                    <td>{formatDate(item.paidAt || item.createdAt)}</td>
                                </tr>
                            ))}
                            {autopayPayments.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                        No AutoPay payment records yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
