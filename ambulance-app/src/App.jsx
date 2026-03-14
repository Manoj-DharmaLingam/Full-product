import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { ambulanceLogin, ambulanceSignup } from './services/api';
import { Navigation, Loader2 } from 'lucide-react';

function AuthView({ onAuthenticated }) {
  const [mode,     setMode]     = useState('login');
  const [form,     setForm]     = useState({
    ambulance_id: '', driver_name: '', driver_phone: '',
    ambulance_registration_number: '', email: '', password: '',
    latitude: null, longitude: null,
  });
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [locating, setLocating] = useState(false);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const switchMode = (m) => { setMode(m); setError(''); };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setField('latitude',  pos.coords.latitude);
        setField('longitude', pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const auth = mode === 'signup'
        ? await ambulanceSignup(form)
        : await ambulanceLogin({ email: form.email, password: form.password });
      localStorage.setItem('ambulance_token', auth.access_token);
      onAuthenticated();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 3H8M12 3v4"/>
            </svg>
          </div>
        </div>
        <h1 className="auth-heading">MediCore Ambulance</h1>
        <p className="auth-sub">
          {mode === 'signup'
            ? 'Register your ambulance to start emergency routing'
            : 'Sign in to access the emergency routing dashboard'}
        </p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login'  ? 'active' : ''}`} onClick={() => switchMode('login')}>Login</button>
          <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>Sign Up</button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <>
              <div className="auth-two-col">
                <input className="form-control" placeholder="Ambulance ID"    value={form.ambulance_id}   onChange={e => setField('ambulance_id',   e.target.value)} required/>
                <input className="form-control" placeholder="Driver Name"     value={form.driver_name}    onChange={e => setField('driver_name',    e.target.value)} required/>
              </div>
              <div className="auth-two-col">
                <input className="form-control" placeholder="Driver Phone"    value={form.driver_phone}   onChange={e => setField('driver_phone',   e.target.value)} required/>
                <input className="form-control" placeholder="Registration No" value={form.ambulance_registration_number} onChange={e => setField('ambulance_registration_number', e.target.value)} required/>
              </div>
              <div className="auth-gps-row">
                <input
                  className="form-control" type="number" step="any" placeholder="Latitude (optional)"
                  value={form.latitude ?? ''}
                  onChange={e => setField('latitude', e.target.value ? Number(e.target.value) : null)}
                />
                <input
                  className="form-control" type="number" step="any" placeholder="Longitude (optional)"
                  value={form.longitude ?? ''}
                  onChange={e => setField('longitude', e.target.value ? Number(e.target.value) : null)}
                />
                <button type="button" className="auth-gps-btn" onClick={detectLocation} disabled={locating}>
                  {locating
                    ? <Loader2 size={16} style={{animation:'spin .8s linear infinite'}}/>
                    : <><Navigation size={14}/> GPS</>
                  }
                </button>
              </div>
              {form.latitude != null && (
                <div className="auth-location-saved">
                  ✓ Location: {Number(form.latitude).toFixed(5)}°N, {Number(form.longitude).toFixed(5)}°E
                </div>
              )}
            </>
          )}

          <input
            className="form-control" type="email" placeholder="Email address"
            value={form.email} onChange={e => setField('email', e.target.value)} required
          />
          <input
            className="form-control" type="password" placeholder="Password"
            value={form.password} onChange={e => setField('password', e.target.value)} required
          />

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading
              ? <Loader2 size={18} style={{animation:'spin .8s linear infinite'}}/>
              : (mode === 'signup' ? 'Create Account' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('ambulance_token')));

  useEffect(() => {
    const handleUnauth = () => setAuthenticated(false);
    window.addEventListener('ambulance:unauthorized', handleUnauth);
    return () => window.removeEventListener('ambulance:unauthorized', handleUnauth);
  }, []);

  if (!authenticated) {
    return <AuthView onAuthenticated={() => setAuthenticated(true)}/>;
  }

  return (
    <Dashboard onLogout={() => { localStorage.removeItem('ambulance_token'); setAuthenticated(false); }}/>
  );
}
