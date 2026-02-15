import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Trash2, CheckCircle, Info } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false }) => {
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            onClose();
        }
    };

    return createPortal(
        <div className="modal-overlay" onClick={handleOverlayClick} style={{ zIndex: 10000 }}>
            <div
                className="modal-content animate-slide-up"
                ref={modalRef}
                style={{
                    maxWidth: '400px',
                    padding: '0',
                    background: 'var(--bg-card)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}
            >
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: isDangerous ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: isDangerous ? 'var(--danger)' : 'var(--accent-blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        boxShadow: isDangerous ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(59, 130, 246, 0.2)'
                    }}>
                        {isDangerous ? <Trash2 size={32} /> : <Info size={32} />}
                    </div>

                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--text-highlight)' }}>{title}</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>{message}</p>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{ minWidth: '100px' }}
                        >
                            {cancelText}
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            style={{
                                background: isDangerous ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'var(--primary)',
                                color: 'white',
                                minWidth: '100px',
                                boxShadow: isDangerous ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(34, 197, 94, 0.3)',
                                border: 'none'
                            }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmationModal;
