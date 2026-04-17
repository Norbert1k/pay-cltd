import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { TRADES } from '../lib/utils';

export default function Login({ onPasswordSet }) {
  const [isRegister, setIsRegister] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [trade, setTrade] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const navigate = useNavigate();

  // Detect if user arrived via password reset link
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsResetMode(true);
    }

    // Also check URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      // Check if there's an active session from the reset token
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsResetMode(true);
        }
      });
    }

    // Listen for auth events — PASSWORD_RECOVERY means they clicked a reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password set successfully! Redirecting...');
      setIsResetMode(false);
      if (onPasswordSet) onPasswordSet();
      setTimeout(() => navigate('/dashboard'), 1500);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!trade) {
      setError('Please select your trade / role');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, trade: trade },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Account created! Please check your email to verify, then wait for an admin to approve your access. You\'ll receive an email once approved.');
      setIsRegister(false);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset email sent. Check your inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <img src="/logo-dark.png" alt="City Construction" className="auth-card__logo" />
          <h1 className="auth-card__title">Timesheet Portal</h1>
          <p className="auth-card__subtitle">pay.cltd.co.uk</p>
        </div>

        {!isResetMode && (
          <div className="auth-card__tabs">
            <button
              className={`auth-tab ${!isRegister ? 'auth-tab--active' : ''}`}
              onClick={() => { setIsRegister(false); setError(''); }}
            >
              Log In
            </button>
            <button
              className={`auth-tab ${isRegister ? 'auth-tab--active' : ''}`}
              onClick={() => { setIsRegister(true); setError(''); }}
            >
              Create Account
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        {/* SET PASSWORD MODE — shown when arriving from reset link */}
        {isResetMode ? (
          <form onSubmit={handleSetNewPassword} className="auth-form">
            <div style={{textAlign: 'center', marginBottom: 16}}>
              <h2 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: 4}}>Set Your Password</h2>
              <p className="text-muted text-sm">Welcome to City Construction Timesheet Portal. Please set a password for your account.</p>
            </div>
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="form-input"
                placeholder="Re-enter your password"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Setting password...' : 'Set Password & Continue'}
            </button>
          </form>
        ) : !isRegister ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Min. 8 characters"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            <button
              type="button"
              className="auth-forgot"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="John Smith"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trade / Role</label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="form-input"
                required
              >
                <option value="">Select your trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Min. 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Confirm your password"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
