import React, { useState } from 'react';
import { Apple, Activity, FileText, Stethoscope } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DashboardPanel from './panels/DashboardPanel';
import FoodDatabasePanel from './panels/FoodDatabasePanel';
import DietChartsPanel from './panels/DietChartsPanel';
import DieticiansPanel from './panels/DieticiansPanel';

// Tabs are role-aware:
//  - admin/superadmin: Dashboard, Food Database, Dieticians (assign members), Diet Charts (view + edit health info)
//  - staff: Dashboard, Food Database, Diet Charts (view + edit health info)
//  - dietician: Diet Charts (build for their members), Food Database
const tabsForRole = (role) => {
    const dashboard = { key: 'dashboard', label: 'Dashboard', icon: Activity, Panel: DashboardPanel };
    const foods = { key: 'foods', label: 'Food Database', icon: Apple, Panel: FoodDatabasePanel };
    const dieticians = { key: 'dieticians', label: 'Dieticians', icon: Stethoscope, Panel: DieticiansPanel };
    const charts = { key: 'charts', label: 'Diet Charts', icon: FileText, Panel: DietChartsPanel };

    if (role === 'dietician') return [charts, foods];
    if (role === 'staff') return [dashboard, foods, charts];
    return [dashboard, foods, dieticians, charts]; // admin / superadmin
};

const Nutrition = () => {
    const { user } = useAuth();
    const TABS = tabsForRole(user?.role);
    const [active, setActive] = useState(TABS[0].key);
    const ActivePanel = TABS.find((t) => t.key === active)?.Panel || TABS[0].Panel;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '0.8rem', borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--primary), #34D399)',
                        color: '#fff', display: 'flex',
                        boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
                    }}>
                        <Apple size={28} strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-page-title">Nutrition Management</h1>
                        <p className="text-body-label" style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Manage food databases, build diet plans, and assign to members
                        </p>
                    </div>
                </div>
            </div>

            {/* Sub-tab navigation */}
            <div style={{
                display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem',
                marginBottom: '2rem', borderBottom: '1px solid var(--border-color)',
                scrollbarWidth: 'none' /* Firefox */
            }}>
                {TABS.map((t) => {
                    const Icon = t.icon;
                    const isActive = active === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setActive(t.key)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: isActive ? 'var(--bg-active)' : 'transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                border: 'none',
                                position: 'relative',
                                borderRadius: '8px 8px 0 0',
                                fontWeight: isActive ? 600 : 500,
                                fontSize: '0.95rem',
                                whiteSpace: 'nowrap',
                                padding: '0.75rem 1.25rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Icon size={18} />
                            <span>{t.label}</span>
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-1px',
                                    left: 0,
                                    width: '100%',
                                    height: '2px',
                                    background: 'var(--primary)',
                                    borderRadius: '2px'
                                }} />
                            )}
                        </button>
                    );
                })}
            </div>

            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <ActivePanel />
            </div>
        </div>
    );
};

export default Nutrition;
