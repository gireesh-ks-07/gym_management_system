import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [confirm, setConfirm] = useState(null); // { message, onConfirm, onCancel, title }

    const addToast = useCallback((message, type = 'info', title = '') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, title }]);
        setTimeout(() => removeToast(id), 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((message, onConfirm, title = 'Are you sure?') => {
        setConfirm({ message, onConfirm, title });
    }, []);

    const handleConfirm = () => {
        if (confirm?.onConfirm) confirm.onConfirm();
        setConfirm(null);
    };

    const handleCancel = () => {
        setConfirm(null);
    };

    return (
        <ToastContext.Provider value={{ addToast, showConfirm }}>
            {children}

            {/* Confirm Dialog */}
            {confirm && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{ marginBottom: '1.5rem', color: 'var(--danger)', display: 'flex', justifyContent: 'center' }}>
                            <XCircle size={48} />
                        </div>
                        <h2 style={{ marginBottom: '0.5rem' }}>{confirm.title}</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{confirm.message}</p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={handleCancel} style={{ flex: 1 }}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleConfirm} style={{ flex: 1 }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast ${toast.type}`}>
                        {toast.type === 'success' && <CheckCircle size={24} color="var(--success)" />}
                        {toast.type === 'error' && <XCircle size={24} color="var(--danger)" />}
                        {toast.type === 'info' && <Info size={24} color="var(--primary)" />}

                        <div className="toast-content">
                            {toast.title && <div className="toast-title">{toast.title}</div>}
                            <div className="toast-message">{toast.message}</div>
                        </div>

                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
