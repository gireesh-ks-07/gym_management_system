import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const AttendanceHistoryModal = ({ isOpen, onClose, clientId, clientName }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && clientId) {
            fetchHistory();
        }
    }, [isOpen, clientId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/client/${clientId}`);
            setHistory(res.data);
        } catch (err) {
            console.error('Failed to fetch attendance history', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'present': return <CheckCircle size={16} className="text-success" />;
            case 'absent': return <XCircle size={16} className="text-error" />;
            case 'excused': return <AlertCircle size={16} className="text-warning" />;
            default: return null;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Attendance History - ${clientName}`}
        >
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
                ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No attendance records found for this member.
                    </div>
                ) : (
                    <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Time</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((record) => (
                                <tr key={record.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={14} color="var(--text-muted)" />
                                            {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Clock size={14} color="var(--text-muted)" />
                                            {record.checkInTime || '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`status-badge status-${record.status}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'capitalize', width: 'fit-content' }}>
                                            {getStatusIcon(record.status)}
                                            {record.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
};

export default AttendanceHistoryModal;
