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
};
