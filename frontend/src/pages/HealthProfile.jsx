import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Area, AreaChart, BarChart, Bar, Cell
} from 'recharts';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  PencilLine,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
  TrendingUp,
  Scale
} from 'lucide-react';
import api from '../api';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_THEME = {
  done: { label: 'Completed', color: '#10b981', dotColor: '#10b981' },
  missed: { label: 'Missed', color: '#ef4444', dotColor: '#ef4444' },
  off_day: { label: 'Off Day', color: '#f59e0b', dotColor: '#f59e0b' },
  cardio: { label: 'Cardio', color: '#3b82f6', dotColor: '#3b82f6' }
};

const emptyDay = (index) => ({
  dayNumber: index + 1,
  focus: '',
  exercises: [{ name: '', sets: '', reps: '', weight: '' }]
});

const toInputDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().split('T')[0];
};

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || '')
    .join('');

const HealthProfile = () => {
  const { id } = useParams();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [successPulse, setSuccessPulse] = useState(false);
  const [member, setMember] = useState(null);
  const [dashboard, setDashboard] = useState({});
  const [profile, setProfile] = useState({
    goalType: '',
    currentWeight: '',
    targetWeight: '',
    height: '',
    bodyFatPercentage: '',
    notes: '',
    weeklyWeights: [],
    currentSchedule: null,
    pastSchedules: [],
    workoutCalendar: []
  });
  const [profileDraft, setProfileDraft] = useState({
    goalType: '',
    currentWeight: '',
    targetWeight: '',
    height: '',
    bodyFatPercentage: '',
    notes: ''
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    notes: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    offDays: ['sunday'],
    days: [emptyDay(0)]
  });
  const [dayLog, setDayLog] = useState({
    dayNumber: 1,
    status: 'done',
    date: new Date().toISOString().split('T')[0],
    note: '',
    cardioMinutes: ''
  });
  const [weightForm, setWeightForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clients/${id}/health-profile`);
      setMember({ id: res.data.clientId, name: res.data.name, phone: res.data.phone });
      setProfile((prev) => ({ ...prev, ...(res.data.healthProfile || {}) }));
      setDashboard(res.data.dashboard || {});
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to load health profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const sortedWeights = useMemo(() => {
    return [...(profile.weeklyWeights || [])]
      .map((x) => ({ date: toInputDate(x.date), weight: Number(x.weight || 0) }))
      .filter((x) => x.date !== '-' && x.weight > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [profile.weeklyWeights]);

  const metrics = useMemo(() => {
    const current = Number(dashboard.currentWeight ?? profile.currentWeight ?? sortedWeights.at(-1)?.weight ?? 0);
    const target = Number(dashboard.targetWeight ?? profile.targetWeight ?? 0);
    const start = Number(sortedWeights[0]?.weight || current || 0);
    const heightM = Number(profile.height || 0) > 0 ? Number(profile.height) / 100 : 0;
    const derivedBmi = heightM > 0 && current > 0 ? current / (heightM * heightM) : 0;

    let derivedProgressPct = 0;
    if (target > 0 && start > 0 && current > 0) {
      if (profile.goalType === 'weight_loss') derivedProgressPct = ((start - current) / Math.max(start - target, 1)) * 100;
      else if (profile.goalType === 'weight_gain' || profile.goalType === 'muscle_gain') derivedProgressPct = ((current - start) / Math.max(target - start, 1)) * 100;
    }
    derivedProgressPct = Math.max(0, Math.min(100, Math.round(derivedProgressPct)));

    const now = new Date();
    // Week stats
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekWeights = sortedWeights.filter((x) => new Date(x.date) >= weekStart);
    const derivedWeekDelta = weekWeights.length >= 2 ? weekWeights.at(-1).weight - weekWeights[0].weight : 0;

    const recentEvents = (profile.workoutCalendar || []).filter((x) => new Date(x.date) >= weekStart);
    const derivedCompletedWeek = recentEvents.filter((x) => x.status === 'done').length;
    const derivedMissedWeek = recentEvents.filter((x) => x.status === 'missed').length;

    // Monthly Trends
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthWeights = sortedWeights.filter((x) => new Date(x.date) >= monthStart);
    const derivedMonthDelta = monthWeights.length >= 2 ? monthWeights.at(-1).weight - monthWeights[0].weight : 0;

    let derivedTrendPct = 0;
    if (weekWeights.length >= 2) {
      const first = Math.max(weekWeights[0].weight, 1);
      derivedTrendPct = Number((((weekWeights.at(-1).weight - weekWeights[0].weight) / first) * 100).toFixed(1));
    }

    return {
      current,
      target,
      bmi: Number(dashboard.bmi ?? derivedBmi ?? 0),
      progressPct: Number(dashboard.progressPct ?? derivedProgressPct ?? 0),
      monthDelta: Number(dashboard.monthDelta ?? derivedMonthDelta ?? 0),
      weekDelta: Number(dashboard.weekDelta ?? derivedWeekDelta ?? 0),
      completedWeek: Number(dashboard.completedWeek ?? derivedCompletedWeek ?? 0),
      missedWeek: Number(dashboard.missedWeek ?? derivedMissedWeek ?? 0),
      trendPct: Number(dashboard.trendPct ?? derivedTrendPct ?? 0)
    };
  }, [profile, sortedWeights, dashboard]);

  const trendTone = useMemo(() => {
    if (profile.goalType === 'weight_loss') {
      if (metrics.weekDelta > 0.2) return '#ef4444'; // Red
      if (metrics.weekDelta > -0.2) return '#f59e0b'; // Amber
      return '#10b981'; // Green
    }
    if (profile.goalType === 'weight_gain' || profile.goalType === 'muscle_gain') {
      if (metrics.weekDelta < -0.1) return '#ef4444';
      if (metrics.weekDelta < 0.2) return '#f59e0b';
      return '#10b981';
    }
    return '#10b981';
  }, [profile.goalType, metrics.weekDelta]);

  // Insights
  const smartInsight = useMemo(() => {
    if (dashboard.smartInsight) return dashboard.smartInsight;
    if (metrics.missedWeek > 2) return 'Missed sessions are piling up. Consider a 2-day recovery split.';
    if (Math.abs(metrics.weekDelta) < 0.05 && (profile.goalType === 'weight_loss' || profile.goalType === 'weight_gain')) return 'Weight progress is plateauing. Adjust caloric intake.';
    return 'Consistency is solid. Maintain progressive overload.';
  }, [metrics.missedWeek, metrics.weekDelta, dashboard.smartInsight, profile.goalType]);

  const streakCount = useMemo(() => {
    if (dashboard.streakCount != null) return Number(dashboard.streakCount);
    // Simple calc
    const doneSet = new Set((profile.workoutCalendar || []).filter((x) => x.status === 'done').map((x) => toInputDate(x.date)));
    let streak = 0;
    const cursor = new Date();
    while (doneSet.has(toInputDate(cursor)) || doneSet.has(toInputDate(new Date(cursor.getTime() - 86400000)))) {
      // Check today or yesterday to keep streak alive
      if (doneSet.has(toInputDate(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (streak === 0 && doneSet.has(toInputDate(new Date(cursor.getTime() - 86400000)))) {
        // If haven't done today but did yesterday, streak is at least 1 (logic tweak)
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [profile.workoutCalendar, dashboard.streakCount]);

  const eventMap = useMemo(() => {
    const map = new Map();
    (profile.workoutCalendar || []).forEach((item) => {
      const key = toInputDate(item.date);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [profile.workoutCalendar]);

  const dayFocusMap = useMemo(() => {
    const map = new Map();
    (profile.currentSchedule?.days || []).forEach((d) => map.set(Number(d.dayNumber), d.focus || 'Workout'));
    return map;
  }, [profile.currentSchedule]);

  const nextWorkoutDay = useMemo(() => {
    if (dashboard.nextWorkoutDay != null) return Number(dashboard.nextWorkoutDay);
    const days = profile.currentSchedule?.days || [];
    if (!days.length) return null;
    const doneEvents = (profile.workoutCalendar || [])
      .filter((x) => x.status === 'done' && x.dayNumber)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastDoneDay = doneEvents.at(-1)?.dayNumber;
    if (!lastDoneDay) return days[0]?.dayNumber;
    const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber).map((d) => d.dayNumber);
    const idx = sortedDays.findIndex((x) => x === lastDoneDay);
    return idx < 0 || idx === sortedDays.length - 1 ? sortedDays[0] : sortedDays[idx + 1];
  }, [profile.currentSchedule, profile.workoutCalendar, dashboard.nextWorkoutDay]);

  useEffect(() => {
    if (nextWorkoutDay != null) setExpandedDay(nextWorkoutDay);
  }, [nextWorkoutDay]);

  const completedDaySet = useMemo(() => {
    if (Array.isArray(dashboard.completedDayNumbers) && dashboard.completedDayNumbers.length) {
      return new Set(dashboard.completedDayNumbers.map((x) => Number(x)));
    }
    const set = new Set();
    (profile.workoutCalendar || []).forEach((item) => {
      if (item.status === 'done' && item.dayNumber) set.add(Number(item.dayNumber));
    });
    return set;
  }, [profile.workoutCalendar, dashboard.completedDayNumbers]);

  const calendarMeta = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const leading = Array.from({ length: firstWeekday }, (_, idx) => ({ key: `blank-${idx}`, isBlank: true }));
    const days = Array.from({ length: daysCount }, (_, idx) => {
      const date = new Date(year, month, idx + 1);
      const key = toInputDate(date);
      const events = eventMap.get(key) || [];
      const statuses = [...new Set(events.map((x) => x.status).filter(Boolean))];
      const hasDone = statuses.includes('done');
      return { key, day: idx + 1, isBlank: false, statuses, events, hasDone };
    });
    return [...leading, ...days];
  }, [calendarMonth, eventMap]);

  const openProfileModal = () => {
    setProfileDraft({
      goalType: profile.goalType || '',
      currentWeight: profile.currentWeight || '',
      targetWeight: profile.targetWeight || '',
      height: profile.height || '',
      bodyFatPercentage: profile.bodyFatPercentage || '',
      notes: profile.notes || ''
    });
    setShowProfileEditor(true);
  };

  const saveProfile = async (data = profileDraft) => {
    try {
      await api.put(`/clients/${id}/health-profile`, data);
      addToast('Health profile saved', 'success');
      setShowProfileEditor(false);
      fetchData();
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to save profile', 'error');
    }
  };

  const createSchedule = async () => {
    if (!scheduleForm.name.trim()) return addToast('Schedule name is required', 'error');
    try {
      await api.post(`/clients/${id}/workout-schedules`, scheduleForm);
      addToast('Workout schedule activated', 'success');
      setShowPlanEditor(false);
      fetchData();
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to create schedule', 'error');
    }
  };

  const markWorkout = async ({ status, dayNumber, note = '', cardioMinutes = '' }) => {
    const scheduleId = profile.currentSchedule?.id;
    if (!scheduleId) return addToast('No active schedule found', 'error');
    if (status === 'missed') {
      const shouldShift = window.confirm('Shift program forward for missed workout?');
      note = shouldShift ? `${note} | Shift requested` : note;
    }
    try {
      await api.post(`/clients/${id}/workout-schedules/${scheduleId}/day-log`, {
        dayNumber,
        status,
        date: new Date().toISOString().split('T')[0],
        note,
        cardioMinutes
      });
      if (status === 'done') {
        setSuccessPulse(true);
        window.setTimeout(() => setSuccessPulse(false), 900);
      }
      addToast('Workout log updated', 'success');
      fetchData();
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to log workout', 'error');
    }
  };

  const addDayLog = async () => {
    const scheduleId = profile.currentSchedule?.id;
    if (!scheduleId) return addToast('No active schedule found', 'error');
    try {
      await api.post(`/clients/${id}/workout-schedules/${scheduleId}/day-log`, dayLog);
      addToast('Workout log updated', 'success');
      fetchData();
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to log workout', 'error');
    }
  };

  const addWeeklyWeight = async () => {
    if (!weightForm.weight) return addToast('Weight is required', 'error');
    try {
      await api.post(`/clients/${id}/weekly-weight`, weightForm);
      setWeightForm((s) => ({ ...s, weight: '' }));
      setShowWeightModal(false);
      addToast('Weekly weight added', 'success');
      fetchData();
    } catch (e) {
      addToast(e?.response?.data?.message || 'Failed to add weekly weight', 'error');
    }
  };

  if (loading) return (
    <div className="loader-container">
      <div className="loader-icon"></div>
      <div className="loading-text">Analyzing Health Data...</div>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>

      {/* Header Profile Section */}
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div className="profile-avatar-lg">
            {initials(member?.name)}
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.2rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {member?.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span>{member?.phone}</span>
              <span>•</span>
              <span style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{profile.goalType ? profile.goalType.replace('_', ' ') : 'No Goal Set'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
          <div>
            <div className="stat-label">Current Streak</div>
            <div className="stat-value-lg" style={{ color: streakCount > 2 ? 'var(--primary)' : 'var(--text-highlight)' }}>
              {streakCount} <span style={{ fontSize: '1rem' }}>days</span>
            </div>
          </div>
          <div>
            <div className="stat-label">Progress</div>
            <div className="stat-value-lg">
              {metrics.progressPct}%
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>

        {/* Left Column - Stats & Summary - Spans 3 columns */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main Key Metrics */}
          <div className="glass-panel">
            <div className="section-header">
              <div className="section-title"><Activity size={18} /> Body Metrics</div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={openProfileModal}>
                <PencilLine size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="metric-card">
                <span className="stat-label">Current Weight</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-highlight)' }}>{metrics.current || '--'}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kg</span>
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px', color: trendTone }}>
                  {metrics.weekDelta > 0 ? '+' : ''}{metrics.weekDelta.toFixed(1)}kg this week
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="metric-card">
                  <span className="stat-label">Target</span>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>{metrics.target || '--'}</div>
                </div>
                <div className="metric-card">
                  <span className="stat-label">Body Fat</span>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>{profile.bodyFatPercentage || '--'}%</div>
                </div>
              </div>

              <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.2), rgba(15, 23, 42, 0))', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Sparkles size={16} color="#a78bfa" />
                  <span style={{ color: '#ddd6fe', fontWeight: 600, fontSize: '0.9rem' }}>Insight</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#ddd6fe', lineHeight: 1.5 }}>
                  {smartInsight}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-panel">
            <div className="section-title" style={{ marginBottom: '1rem' }}><Zap size={18} /> Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button className="btn btn-primary" style={{ justifyContent: 'flex-start' }} onClick={() => setShowWeightModal(true)}>
                <Scale size={16} /> Log Weight
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setShowPlanEditor(true)}>
                <Dumbbell size={16} /> Update Plan
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => setShowQuickLog(!showQuickLog)}>
                <Footprints size={16} /> Log Cardio
              </button>
            </div>
          </div>
        </div>

        {/* Middle Column - Chart & Calendar - Spans 6 columns */}
        <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Progress Chart */}
          <div className="glass-panel">
            <div className="section-header">
              <div className="section-title"><TrendingUp size={18} /> Weight History</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Last 3 Months</div>
            </div>
            <div style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sortedWeights}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendTone} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={trendTone} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
                      }}
                    />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke={trendTone} strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                  {profile.targetWeight && (
                    <Line type="monotone" dataKey={() => Number(profile.targetWeight)} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className="glass-panel">
            <div className="section-header">
              <div className="section-title"><CalendarDays size={18} /> Workout Calendar</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                <button className="icon-btn" onClick={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: '100px', textAlign: 'center' }}>
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button className="icon-btn" onClick={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="calendar-grid">
              {WEEKDAY_LABELS.map(day => (
                <div key={day} className="calendar-header-cell">{day}</div>
              ))}
              {calendarMeta.map((item, i) => {
                if (item.isBlank) return <div key={`blank-${i}`} />;

                const isToday = new Date().toDateString() === new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), item.day).toDateString();
                const hasDone = item.events.some(e => e.status === 'done');

                return (
                  <div
                    key={item.key}
                    className={`calendar-day-cell \${isToday ? 'today' : ''} \${hasDone ? 'active-day' : ''}`}
                  >
                    <span>{item.day}</span>
                    <div className="workout-dots">
                      {item.statuses.slice(0, 3).map((status, idx) => (
                        <div key={idx} className="workout-dot" style={{ backgroundColor: STATUS_THEME[status]?.dotColor || '#94a3b8' }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
              {Object.entries(STATUS_THEME).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: val.color }}></div>
                  {val.label}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column - Schedule & History - Spans 3 columns */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div className="glass-panel" style={{ minHeight: '400px' }}>
            <div className="section-header">
              <div className="section-title"><Target size={18} /> Current Program</div>
            </div>

            {!profile.currentSchedule ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active program. <br /> <a style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setShowPlanEditor(true)}>Create one now</a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {profile.currentSchedule.days.sort((a, b) => a.dayNumber - b.dayNumber).map(day => {
                  const isNext = day.dayNumber === nextWorkoutDay;
                  const isOpen = expandedDay === day.dayNumber;
                  const isDone = completedDaySet.has(Number(day.dayNumber));

                  return (
                    <div key={day.dayNumber}
                      style={{
                        background: isNext ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid \${isNext ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'all 0.3s'
                      }}>
                      <div
                        onClick={() => setExpandedDay(isOpen ? null : day.dayNumber)}
                        style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isNext ? 'var(--primary)' : 'var(--text-main)' }}>
                            Day {day.dayNumber} - {day.focus || 'Workout'}
                          </div>
                          {isDone && <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Completed</div>}
                        </div>
                        <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {day.exercises.map((ex, i) => (
                              <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{ex.name}</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{ex.sets}x{ex.reps} {ex.weight ? `@ ${ex.weight}kg` : ''}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={() => markWorkout({ status: 'done', dayNumber: day.dayNumber, note: 'Done' })}>
                              Mark Done
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => markWorkout({ status: 'missed', dayNumber: day.dayNumber })}>
                              Missed
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-panel">
            <div className="section-title"><Trophy size={18} /> History</div>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {(profile.pastSchedules || []).length === 0 ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No past schedules.</div>
              ) : (
                profile.pastSchedules.slice(0, 5).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{toInputDate(s.startedAt)} - {toInputDate(s.endedAt)}</div>
                    </div>
                    <CheckCircle2 size={16} color="var(--text-muted)" />
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Editor Modal */}
      <Modal isOpen={showProfileEditor} onClose={() => setShowProfileEditor(false)} title="Edit Health Goals">
        <div className="form-grid">
          <div className="input-group"><label className="input-label">Goal Type</label><select className="input-field" value={profileDraft.goalType || ''} onChange={(e) => setProfileDraft({ ...profileDraft, goalType: e.target.value })}><option value="">Select</option><option value="weight_loss">Weight Loss</option><option value="weight_gain">Weight Gain</option><option value="muscle_gain">Muscle Gain</option></select></div>
          <div className="input-group"><label className="input-label">Current Weight</label><input className="input-field" type="number" value={profileDraft.currentWeight || ''} onChange={(e) => setProfileDraft({ ...profileDraft, currentWeight: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Target Weight</label><input className="input-field" type="number" value={profileDraft.targetWeight || ''} onChange={(e) => setProfileDraft({ ...profileDraft, targetWeight: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Height (cm)</label><input className="input-field" type="number" value={profileDraft.height || ''} onChange={(e) => setProfileDraft({ ...profileDraft, height: e.target.value })} /></div>
        </div>
        <div className="form-grid">
          <div className="input-group"><label className="input-label">Body Fat %</label><input className="input-field" type="number" value={profileDraft.bodyFatPercentage || ''} onChange={(e) => setProfileDraft({ ...profileDraft, bodyFatPercentage: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Notes</label><input className="input-field" value={profileDraft.notes || ''} onChange={(e) => setProfileDraft({ ...profileDraft, notes: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowProfileEditor(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => saveProfile(profileDraft)}>Save Changes</button>
        </div>
      </Modal>

      {/* Logic Modal for Weight */}
      <Modal isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} title="Log Weekly Weight">
        <div className="form-grid">
          <div className="input-group"><label className="input-label">Date</label><input className="input-field" type="date" value={weightForm.date} onChange={(e) => setWeightForm({ ...weightForm, date: e.target.value })} /></div>
          <div className="input-group"><label className="input-label">Weight (kg)</label><input className="input-field" type="number" value={weightForm.weight} onChange={(e) => setWeightForm({ ...weightForm, weight: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowWeightModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={addWeeklyWeight}>Save Entry</button>
        </div>
      </Modal>

      {/* Logic Modal for Plan */}
      <Modal isOpen={showPlanEditor} onClose={() => setShowPlanEditor(false)} title="Create Workout Program">
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
            <Sparkles size={16} /> AI-Ready Program Builder
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Define the schedule and days. The system will track progress against this structure.</p>
        </div>

        <div className="form-grid">
          <div className="input-group"><label className="input-label">Program Name</label><input className="input-field" value={scheduleForm.name} onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="e.g. Summer Shred" /></div>
          <div className="input-group"><label className="input-label">Start Date</label><input className="input-field" type="date" value={scheduleForm.startDate} onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })} /></div>
        </div>

        <div className="input-group">
          <label className="input-label">Rest Days</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => (
              <label key={d} style={{
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${scheduleForm.offDays.includes(d) ? 'var(--primary)' : 'var(--border-color)'}`,
                background: scheduleForm.offDays.includes(d) ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                borderRadius: '8px', padding: '6px 12px', transition: 'all 0.2s'
              }}>
                <input type="checkbox" style={{ display: 'none' }} checked={scheduleForm.offDays.includes(d)} onChange={(e) => {
                  const next = e.target.checked ? [...scheduleForm.offDays, d] : scheduleForm.offDays.filter((x) => x !== d);
                  setScheduleForm({ ...scheduleForm, offDays: next });
                }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500, textTransform: 'capitalize', color: scheduleForm.offDays.includes(d) ? 'var(--primary)' : 'var(--text-secondary)' }}>{d.slice(0, 3)}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px', margin: '1rem 0' }}>
          {scheduleForm.days.map((day, dayIdx) => (
            <div key={`day-${dayIdx}`} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '16px', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Day {day.dayNumber} Definition</h4>
                {scheduleForm.days.length > 1 && <button className="btn btn-ghost" style={{ padding: '4px', color: '#ef4444' }} onClick={() => {
                  const next = scheduleForm.days.filter((_, i) => i !== dayIdx);
                  setScheduleForm({ ...scheduleForm, days: next });
                }}><X size={16} /></button>}
              </div>

              <div className="form-grid">
                <div className="input-group">
                  <label className="input-label">Focus Area</label>
                  <input className="input-field" placeholder="e.g. Chest & Triceps" value={day.focus} onChange={(e) => {
                    const next = [...scheduleForm.days];
                    next[dayIdx] = { ...next[dayIdx], focus: e.target.value };
                    setScheduleForm({ ...scheduleForm, days: next });
                  }} />
                </div>
                <div className="input-group">
                  <label className="input-label">Day Number (in sequence)</label>
                  <input className="input-field" type="number" value={day.dayNumber} onChange={(e) => {
                    const next = [...scheduleForm.days];
                    next[dayIdx] = { ...next[dayIdx], dayNumber: Number(e.target.value || 1) };
                    setScheduleForm({ ...scheduleForm, days: next });
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <label className="input-label">Exercises</label>
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 30px', gap: '8px', alignItems: 'center' }}>
                    <input className="input-field" placeholder="Exercise Name" value={ex.name} onChange={(e) => {
                      const next = [...scheduleForm.days];
                      next[dayIdx].exercises[exIdx].name = e.target.value;
                      setScheduleForm({ ...scheduleForm, days: next });
                    }} />
                    <input className="input-field" placeholder="Sets" value={ex.sets} onChange={(e) => {
                      const next = [...scheduleForm.days];
                      next[dayIdx].exercises[exIdx].sets = e.target.value;
                      setScheduleForm({ ...scheduleForm, days: next });
                    }} />
                    <input className="input-field" placeholder="Reps" value={ex.reps} onChange={(e) => {
                      const next = [...scheduleForm.days];
                      next[dayIdx].exercises[exIdx].reps = e.target.value;
                      setScheduleForm({ ...scheduleForm, days: next });
                    }} />
                    <input className="input-field" placeholder="Weight" value={ex.weight} onChange={(e) => {
                      const next = [...scheduleForm.days];
                      next[dayIdx].exercises[exIdx].weight = e.target.value;
                      setScheduleForm({ ...scheduleForm, days: next });
                    }} />
                    <button style={{ color: '#ef4444', background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => {
                      const next = [...scheduleForm.days];
                      next[dayIdx].exercises = next[dayIdx].exercises.filter((_, i) => i !== exIdx);
                      setScheduleForm({ ...scheduleForm, days: next });
                    }}><X size={16} /></button>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => {
                  const next = [...scheduleForm.days];
                  next[dayIdx].exercises.push({ name: '', sets: '', reps: '', weight: '' });
                  setScheduleForm({ ...scheduleForm, days: next });
                }}>+ Add Exercise</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setScheduleForm({ ...scheduleForm, days: [...scheduleForm.days, emptyDay(scheduleForm.days.length)] })}>
            + Add Another Day
          </button>
          <button className="btn btn-primary" onClick={createSchedule}>
            Launch Program
          </button>
        </div>
      </Modal>

      {/* Quick Log Modal */}
      {showQuickLog && (
        <Modal isOpen={showQuickLog} onClose={() => setShowQuickLog(false)} title="Log Cardio / Activity">
          <div className="form-grid">
            <div className="input-group"><label className="input-label">Date</label><input className="input-field" type="date" value={dayLog.date} onChange={(e) => setDayLog({ ...dayLog, date: e.target.value })} /></div>
            <div className="input-group"><label className="input-label">Type</label><select className="input-field" value={dayLog.status} onChange={(e) => setDayLog({ ...dayLog, status: e.target.value })}><option value="cardio">Cardio</option><option value="off_day">Rest Day</option><option value="missed">Missed Workout</option></select></div>
          </div>
          {dayLog.status === 'cardio' && (
            <div className="input-group"><label className="input-label">Duration (minutes)</label><input className="input-field" type="number" value={dayLog.cardioMinutes} onChange={(e) => setDayLog({ ...dayLog, cardioMinutes: e.target.value })} /></div>
          )}
          <div className="input-group"><label className="input-label">Notes</label><input className="input-field" value={dayLog.note} onChange={(e) => setDayLog({ ...dayLog, note: e.target.value })} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={() => setShowQuickLog(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addDayLog}>Save Log</button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default HealthProfile;
