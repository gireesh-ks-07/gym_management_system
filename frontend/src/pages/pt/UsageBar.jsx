import React from 'react';

// Compact "used / allowed" progress bar for a member's PT usage in a period.
const UsageBar = ({ usage }) => {
    if (!usage) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const { used = 0, allowed = 0, remaining = 0, atLimit } = usage;
    const pct = allowed > 0 ? Math.min(100, Math.round((used / allowed) * 100)) : 0;
    const color = atLimit ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#22C55E';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{used}/{allowed}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>({remaining} left)</span>
        </div>
    );
};

export default UsageBar;
