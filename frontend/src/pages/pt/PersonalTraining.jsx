import React, { useState } from 'react';
import { Dumbbell, Users, ClipboardList, BarChart3 } from 'lucide-react';
import PTMembersPanel from './panels/PTMembersPanel';
import PTSessionsPanel from './panels/PTSessionsPanel';
import PTReportsPanel from './panels/PTReportsPanel';

const TABS = [
    { key: 'members', label: 'PT Members', icon: Users, Panel: PTMembersPanel },
    { key: 'sessions', label: 'Sessions', icon: ClipboardList, Panel: PTSessionsPanel },
    { key: 'reports', label: 'Reports', icon: BarChart3, Panel: PTReportsPanel }
];

const PersonalTraining = () => {
    const [active, setActive] = useState('members');
    const ActivePanel = TABS.find((t) => t.key === active)?.Panel || PTMembersPanel;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '0.8rem', borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--primary), #6366F1)',
                        color: '#fff', display: 'flex',
                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                    }}>
                        <Dumbbell size={28} strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-page-title">Personal Training</h1>
                        <p className="text-body-label" style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Track PT members, log sessions, and monitor session usage
                        </p>
                    </div>
                </div>
            </div>

            <div style={{
                display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem',
                marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', scrollbarWidth: 'none'
            }}>
                {TABS.map((t) => {
                    const Icon = t.icon;
                    const isActive = active === t.key;
                    return (
                        <button key={t.key} onClick={() => setActive(t.key)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: isActive ? 'var(--bg-active)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                            border: 'none', position: 'relative', borderRadius: '8px 8px 0 0',
                            fontWeight: isActive ? 600 : 500, fontSize: '0.95rem', whiteSpace: 'nowrap',
                            padding: '0.75rem 1.25rem', cursor: 'pointer', transition: 'all 0.2s ease'
                        }}>
                            <Icon size={18} />
                            <span>{t.label}</span>
                            {isActive && <div style={{ position: 'absolute', bottom: '-1px', left: 0, width: '100%', height: '2px', background: 'var(--primary)', borderRadius: '2px' }} />}
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

export default PersonalTraining;
