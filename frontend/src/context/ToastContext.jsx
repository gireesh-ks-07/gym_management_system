import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

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

    const showConfirm = useCallback((message, onConfirm, title = 'Are you sure?', isDangerous = true) => {
        setConfirm({ message, onConfirm, title, isDangerous });
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
            <ConfirmationModal
                isOpen={!!confirm}
                onClose={handleCancel}
                onConfirm={handleConfirm}
                title={confirm?.title || 'Are you sure?'}
                message={confirm?.message || ''}
                isDangerous={confirm?.isDangerous !== false}
            />

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
