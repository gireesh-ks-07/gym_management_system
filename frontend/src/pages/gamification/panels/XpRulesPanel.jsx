import React from 'react';
import CrudTable from './CrudTable';

const XpRulesPanel = () => (
    <CrudTable
        endpoint="/gamification/xp-rules"
        title="XP Rule"
        addLabel="Add Rule"
        emptyHint="No XP rules. The default rule set is seeded globally."
        columns={[
            { key: 'code', label: 'Code' },
            { key: 'label', label: 'Label' },
            { key: 'xp', label: 'XP', render: (r) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{r.xp}</span> },
            { key: 'category', label: 'Category' },
            { key: 'frequency', label: 'Frequency' },
            { key: 'enabled', label: 'Status', render: (r) => (
                <span className="status-badge" style={{ padding: '3px 10px', borderRadius: 8, background: r.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.15)', color: r.enabled ? 'var(--primary)' : 'var(--inactive)' }}>
                    {r.enabled ? 'Enabled' : 'Disabled'}
                </span>
            ) },
            { key: 'facilityId', label: 'Scope', render: (r) => (r.facilityId ? 'Facility' : 'Global') }
        ]}
        fields={[
            { name: 'code', label: 'Code (unique key)', required: true, half: true, placeholder: 'e.g. workout_completed' },
            { name: 'label', label: 'Label', required: true, half: true },
            { name: 'xp', label: 'XP Amount', type: 'number', required: true, half: true },
            { name: 'category', label: 'Category', default: 'general', half: true },
            { name: 'frequency', label: 'Frequency', type: 'select', default: 'unlimited', half: true,
                options: [{ value: 'unlimited', label: 'Unlimited' }, { value: 'once_per_day', label: 'Once per day' }, { value: 'once', label: 'Once ever' }] },
            { name: 'enabled', label: 'Enabled', type: 'checkbox', default: true, half: true }
        ]}
    />
);

export default XpRulesPanel;
