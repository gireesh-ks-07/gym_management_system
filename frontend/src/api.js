import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseURL = envBaseUrl || 'https://facilityapis.mobilemonks.in';

const api = axios.create({
    baseURL,
});

// --- Request Interceptor: Attach JWT token ---
api.interceptors.request.use((config) => {
    // Automatically prefix with /api if missing
    if (config.url && config.url.startsWith('/') && !config.url.startsWith('/api/')) {
        config.url = `/api${config.url}`;
    }

    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// --- Response Interceptor: Handle expired/invalid tokens ---
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        // 401 = token missing/invalid — clear session and redirect to login
        if (status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

