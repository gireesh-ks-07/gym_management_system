import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [facilitySubscription, setFacilitySubscription] = useState(null);

    const refreshFacilitySubscription = async (nextUser = null) => {
        const effectiveUser = nextUser || user;
        if (!effectiveUser || !['admin', 'staff'].includes(effectiveUser.role)) {
            setFacilitySubscription(null);
            return null;
        }

        try {
            const response = await api.get('/facility/subscription');
            setFacilitySubscription(response.data || null);
            return response.data || null;
        } catch (error) {
            setFacilitySubscription(null);
            return null;
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            refreshFacilitySubscription(parsedUser);
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            await refreshFacilitySubscription(user);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
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
