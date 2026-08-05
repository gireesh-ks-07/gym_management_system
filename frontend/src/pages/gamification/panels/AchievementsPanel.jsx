import React from 'react';
import CrudTable from './CrudTable';

const AchievementsPanel = () => (
    <CrudTable
        endpoint="/gamification/achievements"
        title="Achievement"
        addLabel="Add Achievement"
        emptyHint="No achievements. A starter set is seeded globally."
        columns={[
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'rewardXp', label: 'Reward', render: (r) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{r.rewardXp}</span> },
            { key: 'unlockCondition', label: 'Unlock When', render: (r) => {
                const c = r.unlockCondition || {};
                const op = c.gte != null ? `≥ ${c.gte}` : c.gt != null ? `> ${c.gt}` : c.eq != null ? `= ${c.eq}` : '';
                return c.metric ? `${c.metric} ${op}` : '—';
            } },
            { key: 'status', label: 'Status', render: (r) => (
                <span className="status-badge" style={{ padding: '3px 10px', borderRadius: 8, background: r.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.15)', color: r.status === 'active' ? 'var(--primary)' : 'var(--inactive)' }}>{r.status}</span>
            ) },
            { key: 'facilityId', label: 'Scope', render: (r) => (r.facilityId ? 'Facility' : 'Global') }
        ]}
        fields={[
            { name: 'name', label: 'Name', required: true, half: true },
            { name: 'code', label: 'Code (unique)', required: true, half: true },
            { name: 'category', label: 'Category', type: 'select', default: 'milestones', half: true,
                options: ['attendance', 'workout', 'nutrition', 'weight_loss', 'strength', 'consistency', 'milestones', 'community', 'special'] },
            { name: 'icon', label: 'Icon', default: 'Award', half: true },
            { name: 'rewardXp', label: 'Reward XP', type: 'number', default: 0, half: true },
            { name: 'status', label: 'Status', type: 'select', default: 'active', half: true, options: ['active', 'inactive'] },
            { name: 'visibility', label: 'Visibility', type: 'select', default: 'visible', half: true, options: ['visible', 'hidden'] },
            { name: 'unlockCondition', label: 'Unlock Condition (JSON)', json: true, placeholder: '{ "metric": "attendance_count", "gte": 100 }' }
        ]}
    />
);

export default AchievementsPanel;
