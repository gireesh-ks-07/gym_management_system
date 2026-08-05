import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseURL = envBaseUrl || 'https://facilityapis.mobilemonks.in';

const api = axios.create({
    baseURL,
    // Fail fast (with ECONNABORTED) instead of hanging when the API is unreachable.
    timeout: 15000,
});

// --- Request Interceptor: Attach JWT token ---
api.interceptors.request.use((config) => {
    // Automatically prefix with /api if missing and baseURL doesn't already end with /api
    const base = config.baseURL || '';
    const baseHasApi = base.replace(/\/+$/, '').endsWith('/api');
    if (config.url && config.url.startsWith('/') && !config.url.startsWith('/api/') && !baseHasApi) {
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
        const reqUrl = error.config?.url || '';
        const isLoginRequest = reqUrl.includes('/auth/login');

        // 401 = token missing/invalid — clear session and redirect to login.
        // Don't bounce/clear session on a failed login attempt itself.
        if (status === 401 && !isLoginRequest) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

