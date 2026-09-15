import { useState } from 'react';
import { api, storeToken } from '../services/api.js';

export function LoginPage({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await api.login(credentials);
      storeToken(session.token);
      onLogin(session.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark brand-mark--large">L</span>
          <div><strong>Leslie&apos;s</strong><small>Restaurant Management System</small></div>
        </div>
        <div className="story-copy">
          <p className="eyebrow">Serve with confidence</p>
          <h1>Everything your team needs, right where you need it.</h1>
          <p>Manage your menu, people, and dining room from one dependable local workspace.</p>
        </div>
        <div className="story-status"><span className="offline-dot" /> Local system · Offline ready</div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="mobile-brand">
            <span className="brand-mark">L</span><strong>Leslie&apos;s</strong>
          </div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p className="form-intro">Use your employee credentials to continue.</p>

          {error && <div className="login-error" role="alert">{error}</div>}

          <label className="form-field">
            <span>Username</span>
            <input
              autoFocus
              autoComplete="username"
              value={credentials.username}
              onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
              placeholder="Enter your username"
              required
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={credentials.password}
                onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                placeholder="Enter your password"
                required
              />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          <button className="primary-button login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="login-help">Contact an administrator if you need an account or password reset.</p>
        </form>
      </section>
    </main>
  );
}
