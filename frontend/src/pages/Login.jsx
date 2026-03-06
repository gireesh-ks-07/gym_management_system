import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const { addToast } = useToast();

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            addToast('Please enter a valid email address', 'error');
            return;
        }
        if (password.length < 6) {
            addToast('Password must be at least 6 characters long', 'error');
            return;
        }
        setLoading(true);
        const result = await login(email, password);
        setLoading(false);
        if (!result.success) {
            addToast(result.message, 'error');
            setError(result.message);
        } else {
            addToast('Logged in successfully', 'success');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gradient-dashboard)',
            padding: '1.5rem',
            transition: 'background var(--transition-base)'
        }}>
            <div className="card animate-fade-in" style={{
                width: '100%',
                maxWidth: '440px',
                padding: '3rem 2.5rem',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)',
                background: 'var(--bg-card)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        margin: '0 auto 1.5rem',
                        width: '64px',
                        height: '64px',
                        background: 'var(--primary)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px var(--primary-glow)'
                    }}>
                        <Lock size={32} color="white" strokeWidth={2.5} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-highlight)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Sign in to manage your gym ecosystem</p>
                </div>

                {error && (
                    <div className="animate-fade-in" style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--danger)',
                        padding: '0.875rem',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        fontWeight: '500'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="input-field"
                                style={{ paddingLeft: '2.75rem' }}
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <PasswordInput
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon={<Lock size={18} />}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <span style={{ color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}>Forgot password?</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginTop: '1.5rem',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            boxShadow: '0 4px 12px var(--primary-glow)'
                        }}
                        disabled={loading}
                    >
                        <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div style={{
                    marginTop: '2.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    letterSpacing: '0.04em',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                }}>
                    <div style={{ width: '24px', height: '24px', background: 'var(--text-muted)', borderRadius: '6px', opacity: 0.2 }}></div>
                    <span>Powered by OpsMonks</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
