import axios from 'axios';

// Automatically switch between dev (localhost) and prod (IP) based on environment
const baseURL = import.meta.env.MODE === 'production'
    ? 'http://44.223.67.172/api'
    : 'http://localhost:3000/api';

const api = axios.create({
    baseURL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    console.log('API Request Interceptor - URL:', config.url, 'Token:', token ? 'Found' : 'Missing');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
