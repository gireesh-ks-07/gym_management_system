import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

const AttendanceHistoryModal = ({ isOpen, onClose, clientId, clientName }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

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

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Add empty cells for the first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Create a map of present dates for quick lookup
        const presentDates = new Set(
            history
                .filter(record => record.status === 'present')
                .map(record => new Date(record.date).toDateString())
        );

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isPresent = presentDates.has(date.toDateString());
            const isToday = date.toDateString() === new Date().toDateString();

            days.push(
                <div key={day} className={`calendar-day ${isPresent ? 'present' : ''} ${isToday ? 'today' : ''}`}>
                    <span className="day-number">{day}</span>
                    {isPresent && <Check size={14} className="attendance-tick" />}
                </div>
            );
        }

        return days;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Attendance History - ${clientName}`}
        >
            <div className="attendance-calendar">
                <div className="calendar-controls">
                    <button className="icon-btn" onClick={prevMonth}>
                        <ChevronLeft size={20} />
                    </button>
                    <h3 className="current-month-label">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h3>
                    <button className="icon-btn" onClick={nextMonth}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="calendar-weekdays">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="weekday-label">{d}</div>
                    ))}
                </div>

                <div className="calendar-grid">
                    {loading ? (
                        <div className="calendar-loader">
                            <div className="loader-icon"></div>
                        </div>
                    ) : renderCalendar()}
                </div>

                <div className="calendar-legend">
                    <div className="legend-item">
                        <div className="legend-box present">
                            <Check size={12} />
                        </div>
                        <span>Present</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close History</button>
            </div>

            <style>{`
                .attendance-calendar {
                    padding: 1rem 0;
                }
                .calendar-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                    background: rgba(255,255,255,0.03);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--border-color);
                }
                .current-month-label {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin: 0;
                    color: var(--text-highlight);
                }
                .calendar-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    margin-bottom: 0.5rem;
                }
                .weekday-label {
                    text-align: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 4px;
                    min-height: 280px;
                    position: relative;
                }
                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    position: relative;
                    transition: all 0.2s;
                    cursor: default;
                }
                .calendar-day.empty {
                    background: transparent;
                    border-color: transparent;
                }
                .calendar-day.today {
                    border-color: var(--primary);
                    background: rgba(34, 197, 94, 0.05);
                }
                .calendar-day.today .day-number {
                    color: var(--primary);
                    font-weight: 700;
                }
                .calendar-day.present {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.3);
                }
                .day-number {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
                .attendance-tick {
                    color: var(--primary);
                    margin-top: 2px;
                }
                .calendar-loader {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(30, 41, 59, 0.5);
                    backdrop-filter: blur(2px);
                    z-index: 5;
                    border-radius: var(--radius-sm);
                }
                .calendar-legend {
                    display: flex;
                    gap: 1.5rem;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .legend-box {
                    width: 20px;
                    height: 20px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .legend-box.present {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: var(--primary);
                }
            `}</style>
        </Modal>
    );
};

export default AttendanceHistoryModal;
