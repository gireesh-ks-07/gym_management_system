import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseURL = envBaseUrl || 'https://facilityapis.mobilemonks.in';

const api = axios.create({
    baseURL,
});

api.interceptors.request.use((config) => {
    // Automatically prefix with /api if missing
    if (config.url && config.url.startsWith('/') && !config.url.startsWith('/api/')) {
        config.url = `/api${config.url}`;
    }

    const token = localStorage.getItem('token');
    console.log('API Request Interceptor - URL:', config.url, 'Token:', token ? 'Found' : 'Missing');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
