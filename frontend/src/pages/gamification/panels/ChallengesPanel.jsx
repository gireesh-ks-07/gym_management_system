import React from 'react';
import CrudTable from './CrudTable';

const badge = (text, color) => (
    <span className="status-badge" style={{ padding: '3px 10px', borderRadius: 8, background: `${color}22`, color, textTransform: 'capitalize' }}>{text}</span>
);
const diffColor = { easy: '#10B981', medium: '#F59E0B', hard: '#EF4444' };

const ChallengesPanel = () => (
    <CrudTable
        endpoint="/gamification/challenges"
        title="Challenge"
        addLabel="Add Challenge"
        emptyHint="No challenges. Daily/weekly challenges are auto-generated each day."
        columns={[
            { key: 'title', label: 'Title' },
            { key: 'type', label: 'Type', render: (r) => badge(r.type, '#3B82F6') },
            { key: 'difficulty', label: 'Difficulty', render: (r) => badge(r.difficulty, diffColor[r.difficulty] || '#6B7280') },
            { key: 'xpReward', label: 'Reward', render: (r) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{r.xpReward}</span> },
            { key: 'criteria', label: 'Criteria', render: (r) => r.criteria ? `${r.criteria.metric} × ${r.criteria.target}` : '—' },
            { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'active' ? '#10B981' : '#6B7280') }
        ]}
        fields={[
            { name: 'title', label: 'Title', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'type', label: 'Type', type: 'select', default: 'daily', half: true,
                options: ['daily', 'weekly', 'monthly', 'seasonal'] },
            { name: 'difficulty', label: 'Difficulty', type: 'select', default: 'easy', half: true,
                options: ['easy', 'medium', 'hard'] },
            { name: 'xpReward', label: 'XP Reward', type: 'number', default: 50, half: true },
            { name: 'status', label: 'Status', type: 'select', default: 'active', half: true,
                options: ['active', 'inactive', 'archived'] },
            { name: 'startDate', label: 'Start Date', type: 'date', half: true },
            { name: 'endDate', label: 'End Date', type: 'date', half: true },
            { name: 'criteria', label: 'Completion Criteria (JSON)', json: true, placeholder: '{ "metric": "workout_completed", "target": 1 }' }
        ]}
    />
);

export default ChallengesPanel;
