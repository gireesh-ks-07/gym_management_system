import React, { useEffect, useState } from 'react';
import api from '../api';
import {
    Users, Wallet, Dumbbell, TrendingUp, Calendar, Activity, AlertCircle, Wifi
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import SuperAdminDashboard from './SuperAdminDashboard';

import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/date';

const Dashboard = () => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState(null);
    const navigate = useNavigate();

    if (user?.role === 'superadmin') {
        return <SuperAdminDashboard />;
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch sub status first or in parallel, but handle independently
                const subRes = await api.get('/facility/subscription').catch(() => null);
                setSubscription(subRes?.data || null);

                if (subRes?.data?.subscriptionStatus !== 'active' && user?.role !== 'superadmin') {
                    // If suspended/expired, don't bother fetching dashboard data or just let it fail silently
                    // We will block UI anyway
                }

                const dashboardRes = await api.get('/dashboard');
                setData(dashboardRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return (
        <div className="loader-container">
            <div className="loader-icon"></div>
            <div className="loading-text">PREPARING DASHBOARD...</div>
        </div>
    );

    // Blocking View for Expired/Suspended Subscription
    if (subscription && subscription.subscriptionStatus !== 'active' && user?.role !== 'superadmin') {
        const isExpired = subscription.subscriptionStatus === 'expired';
        return (
            <div className="animate-fade-in" style={{
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '1.5rem'
            }}>
                <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: 'var(--danger)' }}>
                    <AlertCircle size={48} />
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {isExpired ? 'Subscription Expired' : 'Account Suspended'}
                </h1>
                <p style={{ maxWidth: '500px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {isExpired
                        ? 'Your facility\'s subscription plan has expired. To continue using the platform and accessing your data, please renew your subscription.'
                        : 'Your account has been suspended by the platform administrator. Please contact support for assistance.'}
                </p>
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', minWidth: '300px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Current Status</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)', textTransform: 'uppercase' }}>
                        {subscription.subscriptionStatus}
                    </div>
                </div>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
                    Check Status Again
                </button>
            </div>
        );
    }

    if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Failed to load dashboard data.</div>;

    const { stats, recentClients, revenueChartData, revenueByMethod, planChartData } = data;
    const memberLimit = subscription?.SubscriptionPlan?.maxMembers ?? subscription?.subscriptionPlan?.maxMembers ?? null;
    const staffLimit = subscription?.SubscriptionPlan?.maxStaff ?? subscription?.subscriptionPlan?.maxStaff ?? null;
    const memberLimitExceeded = memberLimit !== null && Number(stats.totalClients) >= Number(memberLimit);
    const staffLimitExceeded = staffLimit !== null && Number(stats.activeStaff) >= Number(staffLimit);

    const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Mock sparkline data since we don't have real historical data for all KPIs
    const Sparkline = ({ color }) => (
        <svg width="100" height="30" viewBox="0 0 100 30" fill="none" style={{ opacity: 0.7 }}>
            <path d="M0 25 C20 25, 20 10, 40 10 C60 10, 60 20, 80 15 C90 12, 95 5, 100 2" stroke={color} strokeWidth="2" fill="none" />
            <path d="M0 25 C20 25, 20 10, 40 10 C60 10, 60 20, 80 15 C90 12, 95 5, 100 2 V 30 H 0 Z" fill={`url(#gradient-${color})`} opacity="0.2" />
            <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
        </svg>
    );

    const StatCard = ({ title, value, icon, color, trend, path }) => (
        <div
            className="card"
            style={{
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                cursor: path ? 'pointer' : 'default',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onClick={() => path && navigate(path)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${color}15`, color: color }}>
                    {icon}
                </div>
                {trend && (
                    <div className={`stat-trend ${trend > 0 ? 'trend-up' : 'trend-down'}`}>
                        {trend > 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} style={{ transform: 'rotate(180deg)' }} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>

            <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{title}</h3>
                <div className="stat-card-value">{value}</div>
            </div>

            <div style={{ position: 'absolute', bottom: '1rem', right: '1rem' }}>
                <Sparkline color={color} />
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Real-time overview of your facility.</p>
                </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {subscription && (
                        <div className={`card ${subscription.subscriptionStatus === 'active' ? 'status-active' : 'status-expired'}`}
                            style={{
                                padding: '0.5rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                borderRadius: '12px',
                                background: subscription.subscriptionStatus === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${subscription.subscriptionStatus === 'active' ? 'var(--success)' : 'var(--danger)'}`,
                                color: subscription.subscriptionStatus === 'active' ? 'var(--success)' : 'var(--danger)'
                            }}>
                            <Activity size={16} />
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Subscription</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {subscription.subscriptionStatus === 'active' ? 'Active' : 'Expired'}
                                    {subscription.subscriptionExpiresAt && (
                                        <span style={{ fontWeight: 'normal', opacity: 0.8, marginLeft: '5px' }}>
                                            (Exp: {formatDate(subscription.subscriptionExpiresAt)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {(memberLimitExceeded || staffLimitExceeded) && (
                <div
                    className="card"
                    style={{
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: 'var(--danger)',
                        padding: '0.9rem 1rem',
                        fontWeight: 600
                    }}
                >
                    {memberLimitExceeded && <div>Exceeded limit: Members {stats.totalClients}/{memberLimit}</div>}
                    {staffLimitExceeded && <div>Exceeded limit: Staff {stats.activeStaff}/{staffLimit}</div>}
                </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    title="Total Members"
                    value={stats.totalClients}
                    icon={<Users size={24} />}
                    color="#22c55e"
                    trend={12.5}
                    path="/clients"
                />
                <StatCard
                    title="Monthly Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString()}`}
                    icon={<Wallet size={24} />}
                    color="#10B981"
                    trend={8.2}
                    path="/payments"
                />
                <StatCard
                    title="Active Staff"
                    value={stats.activeStaff}
                    icon={<Activity size={24} />}
                    color="#f59e0b"
                    path="/staff"
                />
                <StatCard
                    title="Expired Members"
                    value={stats.expiredClients ?? stats.dueClients ?? 0}
                    icon={<AlertCircle size={24} />}
                    color="#ef4444"
                    path="/clients?status=payment_due"
                />
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>

                {/* Revenue Chart (Spans 8 columns) */}
                <div className="card dashboard-chart-card" style={{ gridColumn: 'span 8', padding: '1.5rem', minHeight: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Revenue Overview</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Income trend over the last 6 months</p>
                        </div>
                        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>View Detail</button>
                    </div>

                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `₹${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        boxShadow: 'var(--shadow-xl)',
                                        color: 'var(--text-main)'
                                    }}
                                    itemStyle={{ color: 'var(--primary)' }}
                                    formatter={(value) => [`₹${value.toLocaleString()}`, "Revenue"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Plan Distribution (Spans 4 columns) */}
                <div className="card dashboard-pie-card" style={{ gridColumn: 'span 4', padding: '1.5rem', minHeight: '400px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Membership Plans</h3>
                    <div style={{ height: '300px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={planChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={6}
                                    stroke="none"
                                >
                                    {planChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '5px' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text for Donut */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
                            textAlign: 'center', pointerEvents: 'none'
                        }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalClients}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Members</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Members Table */}
            <div className="card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>Recent Registrations</h3>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>View All</button>
                </div>
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '2rem' }}>Member Name</th>
                                <th>Plan Details</th>
                                <th>Joined</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentClients.map((client, index) => (
                                <tr key={client.id || index}>
                                    <td style={{ paddingLeft: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: `linear-gradient(135deg, ${COLORS[index % 5]}, ${COLORS[(index + 1) % 5]})`,
                                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem'
                                            }}>
                                                {client.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{client.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{client.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {client.Plan ? (
                                            <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>{client.Plan.name}</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No Plan</span>
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        {formatDate(client.joiningDate)}
                                    </td>
                                    <td>
                                        <span className="status-badge status-active">Active</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
