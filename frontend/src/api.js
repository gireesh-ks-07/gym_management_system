import axios from 'axios';

// Automatically switch between dev (localhost) and prod (IP) based on environment
const baseURL = import.meta.env.MODE === 'production'
    ? 'https://facilityapis.mobilemonks.in'
    : 'http://localhost:3000';

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
