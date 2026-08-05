import React from 'react';
import CrudTable from './CrudTable';

const LeaguesPanel = () => (
    <CrudTable
        endpoint="/gamification/leagues"
        title="League"
        addLabel="Add League"
        emptyHint="No leagues configured. The default Bronze→Legend ladder is seeded globally."
        columns={[
            { key: 'tier', label: 'Tier' },
            { key: 'name', label: 'Name', render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: r.color, display: 'inline-block' }} />
                    {r.name}
                </span>
            ) },
            { key: 'promotionCount', label: 'Promote' },
            { key: 'relegationCount', label: 'Relegate' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'rewardXp', label: 'Reward XP' },
            { key: 'facilityId', label: 'Scope', render: (r) => (r.facilityId ? 'This facility' : 'Global') }
        ]}
        fields={[
            { name: 'name', label: 'Name', required: true, half: true },
            { name: 'tier', label: 'Tier (order)', type: 'number', required: true, half: true },
            { name: 'color', label: 'Color (hex)', default: '#10B981', half: true },
            { name: 'icon', label: 'Icon', default: 'Shield', half: true },
            { name: 'promotionCount', label: 'Promotion Count', type: 'number', default: 5, half: true },
            { name: 'relegationCount', label: 'Relegation Count', type: 'number', default: 5, half: true },
            { name: 'capacity', label: 'Capacity', type: 'number', default: 30, half: true },
            { name: 'rewardXp', label: 'Reward XP', type: 'number', default: 0, half: true },
            { name: 'autoPromotion', label: 'Auto Promotion', type: 'checkbox', default: true, half: true }
        ]}
    />
);

export default LeaguesPanel;
