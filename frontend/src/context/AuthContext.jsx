import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext();

// Turn an axios error into a clear, user-facing login message.
const getLoginErrorMessage = (error) => {
    // No response object = the request never reached the server
    // (backend down, wrong URL, network offline, CORS, or a timeout).
    if (!error.response) {
        if (error.code === 'ECONNABORTED') {
            return 'The server took too long to respond. Please try again.';
        }
        return 'Unable to reach the server. Please check your connection and make sure the API is running.';
    }

    const { status, data } = error.response;
    if (status === 401 || status === 404) return 'Invalid email or password.';
    if (status === 429) return data?.message || 'Too many attempts. Please wait a few minutes and try again.';
    if (status === 400) return data?.message || 'Please check your details and try again.';
    if (status >= 500) return 'Something went wrong on our end. Please try again shortly.';
    return data?.message || 'Login failed. Please try again.';
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [facilitySubscription, setFacilitySubscription] = useState(null);

    const refreshFacilitySubscription = useCallback(async (nextUser = null) => {
        const effectiveUser = nextUser || user;
        if (!effectiveUser || !['admin', 'staff'].includes(effectiveUser.role)) {
            setFacilitySubscription(null);
            return null;
        }

        try {
            const response = await api.get('/facility/subscription');
            setFacilitySubscription(response.data || null);
            return response.data || null;
        } catch {
            setFacilitySubscription(null);
            return null;
        }
    }, [user]);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');

            if (storedUser && token) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                refreshFacilitySubscription(parsedUser);
            }
        } catch (e) {
            // Corrupted localStorage — clear it and force re-login
            console.warn('Corrupted auth storage, clearing.', e);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            try {
                await refreshFacilitySubscription(user);
            } catch (subErr) {
                console.warn('Facility subscription refresh failed during login:', subErr?.message);
            }
            return { success: true };
        } catch (error) {
            return { success: false, message: getLoginErrorMessage(error) };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setFacilitySubscription(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, facilitySubscription, refreshFacilitySubscription }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
