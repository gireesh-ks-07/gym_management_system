import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, Trash2, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';

const ActionMenu = ({ onEdit, onDelete, onHistory, editLabel = 'Edit', deleteLabel = 'Delete', historyLabel = 'Attendance History' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    const toggleMenu = (e) => {
        e.stopPropagation();
        if (!isOpen) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Calculate position to prevent overflow
            // Default: bottom-right of the button
            let top = rect.bottom + window.scrollY + 5;
            let left = rect.right + window.scrollX - 160; // 160px is approx width of menu

            // Boundary checks could be added here if needed
            setPosition({ top, left });
        }
        setIsOpen(!isOpen);
    };

    const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target) && !buttonRef.current.contains(e.target)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', () => setIsOpen(false)); // Close on scroll
            window.addEventListener('resize', () => setIsOpen(false));
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', () => setIsOpen(false));
            window.removeEventListener('resize', () => setIsOpen(false));
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', () => setIsOpen(false));
            window.removeEventListener('resize', () => setIsOpen(false));
        };
    }, [isOpen]);

    const handleAction = (action) => {
        setIsOpen(false);
        action();
    };

    // Portal content
    const menuContent = (
        <div
            ref={menuRef}
            className="action-menu-popup animate-fade-in"
            style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                zIndex: 9999,
                width: '180px'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {onHistory && (
                <button className="action-menu-item" onClick={() => handleAction(onHistory)}>
                    <Calendar size={16} />
                    <span>{historyLabel}</span>
                </button>
            )}
            {onEdit && (
                <button className="action-menu-item" onClick={() => handleAction(onEdit)}>
                    <Edit size={16} />
                    <span>{editLabel}</span>
                </button>
            )}
            {onDelete && (
                <button className="action-menu-item delete" onClick={() => handleAction(onDelete)}>
                    <Trash2 size={16} />
                    <span>{deleteLabel}</span>
                </button>
            )}
        </div>
    );

    return (
        <>
            <button
                ref={buttonRef}
                className={`icon-btn action-menu-trigger ${isOpen ? 'active' : ''}`}
                onClick={toggleMenu}
            >
                <MoreVertical size={18} />
            </button>
            {isOpen && createPortal(menuContent, document.body)}
        </>
    );
};

export default ActionMenu;
