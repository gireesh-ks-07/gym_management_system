import api from '../api'; // existing axios instance

// API wrapper for the dietician / per-client diet-chart feature.
export const dieticianApi = {
    // --- Dietician management (admin) ---
    getDieticians: (facilityId) =>
        api.get('/nutrition/dieticians', { params: { facilityId } }).then(res => res.data),

    assignClient: (dieticianId, clientId) =>
        api.post(`/nutrition/dieticians/${dieticianId}/clients`, { clientId }).then(res => res.data),

    unassignClient: (clientId) =>
        api.delete(`/nutrition/dieticians/clients/${clientId}`).then(res => res.data),

    // --- Clients in the workspace (admin: all, dietician: assigned) ---
    getClients: (facilityId) =>
        api.get('/nutrition/dietician/clients', { params: { facilityId } }).then(res => res.data),

    // Compact health-profile data for pre-filling / syncing a diet chart
    getClientHealth: (clientId, facilityId) =>
        api.get(`/nutrition/dietician/clients/${clientId}/health`, { params: { facilityId } }).then(res => res.data),

    // --- Diet charts ---
    getCharts: (facilityId, clientId) =>
        api.get('/nutrition/charts', { params: { facilityId, clientId } }).then(res => res.data),

    getChart: (id, facilityId) =>
        api.get(`/nutrition/charts/${id}`, { params: { facilityId } }).then(res => res.data),

    createChart: (data) =>
        api.post('/nutrition/charts', data).then(res => res.data),

    updateChart: (id, data) =>
        api.put(`/nutrition/charts/${id}`, data).then(res => res.data),

    deleteChart: (id) =>
        api.delete(`/nutrition/charts/${id}`).then(res => res.data),

    // Download the letterheaded PDF. Returns { blob, filename } — the filename
    // comes from the server's Content-Disposition so the browser download and
    // the document itself agree on what the chart is called.
    exportChartPdf: (id, facilityId) =>
        api.get(`/nutrition/charts/${id}/pdf`, {
            params: { facilityId },
            responseType: 'blob'
        }).then((res) => {
            const disposition = res.headers['content-disposition'] || '';
            const match = /filename="?([^"]+)"?/.exec(disposition);
            return { blob: res.data, filename: match ? match[1] : 'diet-chart.pdf' };
        }),

    // --- Letterhead (facility identity printed on generated documents) ---
    getLetterhead: (facilityId) =>
        api.get('/nutrition/letterhead', { params: { facilityId } }).then(res => res.data),

    updateLetterhead: (data, facilityId) =>
        api.put('/nutrition/letterhead', data, { params: { facilityId } }).then(res => res.data),
};
