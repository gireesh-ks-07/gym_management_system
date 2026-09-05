/**
 * Local recovery for in-progress diet charts.
 *
 * The dirty-state guard catches a deliberate Back, but not a closed tab, a
 * crashed browser or a flat battery — and these assessments take a long sitting
 * to fill, so losing one is a real and frequent harm.
 *
 * Against that: a draft is a clinical record. Present and previous conditions,
 * family history, biochemical results, medications. A facility's front desk is
 * often a shared machine, so the exposure is not hypothetical. Two mitigations
 * follow from that, and they are why this lives in its own module rather than
 * inside the builder:
 *
 *   - hours, not days, so a draft is not still sitting there tomorrow;
 *   - cleared on sign-out and on session expiry, which needs to be reachable
 *     from AuthContext without importing the lazily-loaded builder page.
 *
 * Per-browser recovery only. The server remains the source of truth.
 */

const DRAFT_PREFIX = 'dietchart:draft:';
const DRAFT_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export const readDraft = (chartId) => {
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + chartId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
            localStorage.removeItem(DRAFT_PREFIX + chartId);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

export const writeDraft = (chartId, form) => {
    try {
        localStorage.setItem(DRAFT_PREFIX + chartId, JSON.stringify({ savedAt: Date.now(), form }));
    } catch {
        /* quota, or private mode — recovery is best-effort by design */
    }
};

export const clearDraft = (chartId) => {
    try {
        localStorage.removeItem(DRAFT_PREFIX + chartId);
    } catch {
        /* ignore */
    }
};

/** Sign-out and session expiry. Never leave an assessment on a shared machine. */
export const clearAllDrafts = () => {
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(DRAFT_PREFIX))
            .forEach((k) => localStorage.removeItem(k));
    } catch {
        /* ignore */
    }
};
