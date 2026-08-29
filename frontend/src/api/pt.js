import api from '../api'; // existing axios instance (baseURL includes /api)

export const ptApi = {
    // Members on a PT plan (with current-period usage)
    getMembers: (facilityId) =>
        api.get('/pt/members', { params: { facilityId } }).then(res => res.data),

    getMemberDetail: (clientId, facilityId) =>
        api.get(`/pt/members/${clientId}`, { params: { facilityId } }).then(res => res.data),

    // Sessions
    getSessions: (params = {}) =>
        api.get('/pt/sessions', { params }).then(res => res.data),

    createSession: (data) =>
        api.post('/pt/sessions', data).then(res => res.data),

    updateSession: (id, data) =>
        api.put(`/pt/sessions/${id}`, data).then(res => res.data),

    deleteSession: (id) =>
        api.delete(`/pt/sessions/${id}`).then(res => res.data),

    // Reports
    getReports: (params = {}) =>
        api.get('/pt/reports', { params }).then(res => res.data),
};
