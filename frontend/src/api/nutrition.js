import api from '../api'; // existing axios instance

export const nutritionApi = {
    // Analytics
    getAnalytics: (facilityId) =>
        api.get('/nutrition/analytics', { params: { facilityId } }).then(res => res.data),

    // Foods
    getFoods: (facilityId) =>
        api.get('/nutrition/foods', { params: { facilityId } }).then(res => res.data),
    
    createFood: (data) =>
        api.post('/nutrition/foods', data).then(res => res.data),
    
    updateFood: (id, data) =>
        api.put(`/nutrition/foods/${id}`, data).then(res => res.data),
    
    deleteFood: (id) =>
        api.delete(`/nutrition/foods/${id}`).then(res => res.data),

    // Diet Plans
    getPlans: (facilityId) =>
        api.get('/nutrition/plans', { params: { facilityId } }).then(res => res.data),

    createPlan: (data) =>
        api.post('/nutrition/plans', data).then(res => res.data),

    updatePlan: (id, data) =>
        api.put(`/nutrition/plans/${id}`, data).then(res => res.data),

    updatePlanMeals: (planId, meals) =>
        api.put(`/nutrition/plans/${planId}/meals`, { meals }).then(res => res.data),

    duplicatePlan: (id) =>
        api.post(`/nutrition/plans/${id}/duplicate`).then(res => res.data),

    deletePlan: (id) =>
        api.delete(`/nutrition/plans/${id}`).then(res => res.data),

    // Assignments
    getAssignments: (facilityId, status) =>
        api.get('/nutrition/assignments', { params: { facilityId, status } }).then(res => res.data),

    assignPlan: (data) =>
        api.post('/nutrition/assign', data).then(res => res.data),

    updateAssignment: (id, data) =>
        api.put(`/nutrition/assignments/${id}`, data).then(res => res.data),

    deleteAssignment: (id) =>
        api.delete(`/nutrition/assignments/${id}`).then(res => res.data),
};
