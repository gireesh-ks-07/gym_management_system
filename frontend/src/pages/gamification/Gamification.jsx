import React, { useState } from 'react';
import { Trophy, BarChart3, Crown, Zap, Target, Award, Gift } from 'lucide-react';
import DashboardPanel from './panels/DashboardPanel';
import LeaderboardPanel from './panels/LeaderboardPanel';
import LeaguesPanel from './panels/LeaguesPanel';
import XpRulesPanel from './panels/XpRulesPanel';
import ChallengesPanel from './panels/ChallengesPanel';
import AchievementsPanel from './panels/AchievementsPanel';
import RewardsPanel from './panels/RewardsPanel';

const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, Panel: DashboardPanel },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy, Panel: LeaderboardPanel },
    { key: 'leagues', label: 'Leagues', icon: Crown, Panel: LeaguesPanel },
    { key: 'xp', label: 'XP Rules', icon: Zap, Panel: XpRulesPanel },
    { key: 'challenges', label: 'Challenges', icon: Target, Panel: ChallengesPanel },
    { key: 'achievements', label: 'Achievements', icon: Award, Panel: AchievementsPanel },
    { key: 'rewards', label: 'Rewards', icon: Gift, Panel: RewardsPanel }
];

const Gamification = () => {
    const [active, setActive] = useState('dashboard');
    const ActivePanel = TABS.find((t) => t.key === active)?.Panel || DashboardPanel;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        padding: '0.6rem', borderRadius: '14px',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                        color: '#fff', display: 'flex'
                    }}>
                        <Trophy size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>Gamification</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Motivate members with XP, streaks, leagues and rewards</p>
                    </div>
                </div>
            </div>

            {/* Sub-tab navigation */}
            <div style={{
                display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem',
                marginBottom: '1.75rem', borderBottom: '1px solid var(--border-color)'
            }}>
                {TABS.map((t) => {
                    const Icon = t.icon;
                    const isActive = active === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setActive(t.key)}
                            className="btn"
                            style={{
                                background: isActive ? 'var(--bg-active)' : 'transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                border: 'none',
                                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                borderRadius: '10px 10px 0 0',
                                fontWeight: isActive ? 700 : 500,
                                whiteSpace: 'nowrap',
                                padding: '0.6rem 1rem'
                            }}
                        >
                            <Icon size={17} />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <ActivePanel />
        </div>
    );
};

export default Gamification;
