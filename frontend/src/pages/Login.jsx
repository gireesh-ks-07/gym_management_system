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
            background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
            padding: '1rem'
        }}>
            <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <img
                        src="/logo_with_image.svg"
                        alt="MobileMonks"
                        style={{ width: '180px', maxWidth: '100%', margin: '0 auto 1.25rem', display: 'block' }}
                    />
                    <p style={{ color: 'var(--text-secondary)' }}>Sign in to manage your empire</p>
                </div>

                {error && (
                    <div className="animate-fade-in" style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
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
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', marginTop: '1rem', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <p>Forgot password? <span style={{ color: 'var(--primary)', cursor: 'pointer' }}>Reset it</span></p>
                </div>

                <div style={{
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    letterSpacing: '0.04em'
                }}>
                    <img src="/mobilemonks-logo.png" alt="MobileMonks" style={{ width: '28px', height: '28px', borderRadius: '999px' }} />
                    <span>Powered by MobileMonks</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
