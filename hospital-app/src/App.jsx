/*
 * hospital-app/src/App.jsx
 * MediCore — Modern Hospital SaaS Platform
 * Complete redesign with hash-based routing and new feature pages.
 * All existing API calls (getPublicHospitals, getHospitalMe, updateHospitalIcu,
 * getHospitalAlerts, updateAlertStatus, updateHospitalLocation, hospitalSignup,
 * hospitalLogin) are preserved and unchanged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, BedDouble, Bell, BellOff,
  Building2, CheckCircle2, Clock, Droplets, FileText,
  Loader2, LogOut, MapPin, Navigation, XCircle,
  ChevronLeft, Stethoscope, Wind, FlaskConical, Calendar,
  Users, LayoutDashboard, Settings, Plus, Minus, Eye,
  Trash2, Ban, CheckCircle, X, Heart, Award, Mail,
  Phone, User, BookOpen, Home, ShieldCheck, Syringe,
} from 'lucide-react';
import './App.css';
import {
  getHospitalAlerts, getHospitalMe, getPublicHospitals,
  hospitalLogin, hospitalSignup, updateAlertStatus,
  updateHospitalIcu, updateHospitalLocation,
  getMyDoctors, createDoctor, updateDoctor, deleteDoctor, getPublicDoctors,
} from './services/api';

/* ─── Constants ──────────────────────────────────────────────────── */
const POLL_INTERVAL = 5000;

/* ─── Blood bank initial state (localStorage-backed) ────────────── */
const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
function loadBloodBank() {
  try {
    const s = localStorage.getItem('mc_blood_bank');
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  const initial = {};
  BLOOD_TYPES.forEach(t => { initial[t] = { units: Math.floor(Math.random()*20)+5, updated: new Date().toISOString() }; });
  return initial;
}
function saveBloodBank(data) {
  try { localStorage.setItem('mc_blood_bank', JSON.stringify(data)); } catch { /* ignore */ }
}

/* ─── Oxygen state (localStorage-backed) ────────────────────────── */
function loadOxygen() {
  try {
    const s = localStorage.getItem('mc_oxygen');
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return { total: 120, available: 87, inUse: 33 };
}
function saveOxygen(data) {
  try { localStorage.setItem('mc_oxygen', JSON.stringify(data)); } catch { /* ignore */ }
}

/* ─── Appointments (localStorage-backed) ────────────────────────── */
function loadAppointments() {
  try {
    const s = localStorage.getItem('mc_appointments');
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return [];
}
function saveAppointments(list) {
  try { localStorage.setItem('mc_appointments', JSON.stringify(list)); } catch { /* ignore */ }
}

/* ─── Admin suspended set ────────────────────────────────────────── */
function loadSuspended() {
  try { const s = localStorage.getItem('mc_suspended'); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
}
function saveSuspended(set) {
  try { localStorage.setItem('mc_suspended', JSON.stringify([...set])); } catch { /* ignore */ }
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function icuStatus(available, total) {
  if (!total) return { label: 'Unknown', cls: 'badge-muted' };
  const r = available / total;
  if (r === 0)    return { label: 'ICU Full', cls: 'badge-danger' };
  if (r <= 0.25)  return { label: 'Critical',  cls: 'badge-danger' };
  if (r <= 0.5)   return { label: 'Limited',   cls: 'badge-warning' };
  return { label: 'Available', cls: 'badge-success' };
}
function severityCls(sev) {
  const s = (sev||'').toLowerCase();
  if (s==='critical') return 'sev-critical';
  if (s==='serious')  return 'sev-serious';
  return 'sev-moderate';
}
function avatarLetter(name) {
  const parts = name.replace('Dr. ','').split(' ');
  return parts.length >= 2 ? parts[0][0]+parts[1][0] : parts[0][0] || 'D';
}
function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); } catch { return iso; }
}

/* ─── Hash Router ────────────────────────────────────────────────── */
function useRouter() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const fn = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  const navigate = useCallback((to) => { window.location.hash = to; }, []);
  const match = useCallback((pattern) => {
    const parts   = hash.split('/').filter(Boolean);
    const pparts  = pattern.split('/').filter(Boolean);
    if (parts.length !== pparts.length) return null;
    const params = {};
    for (let i = 0; i < pparts.length; i++) {
      if (pparts[i].startsWith(':')) params[pparts[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pparts[i] !== parts[i]) return null;
    }
    return params;
  }, [hash]);
  return { hash, navigate, match };
}

/* ─── Toast System ───────────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type='info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismiss = (id) => setToasts(p => p.filter(t => t.id !== id));
  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">
            {t.type==='success' && <CheckCircle2 size={18}/>}
            {t.type==='error'   && <XCircle      size={18}/>}
            {t.type==='info'    && <Bell          size={18}/>}
          </span>
          <span className="toast-msg">{t.msg}</span>
          <X size={15} className="toast-close"/>
        </div>
      ))}
    </div>
  );
  return { push, ToastContainer };
}

/* ─── Navbar ─────────────────────────────────────────────────────── */
function Navbar({ authenticated, hospitalName, navigate, hash, onLogout }) {
  const isPublic    = hash === '/' || hash.startsWith('/hospital/') || hash.startsWith('/book/');
  const isDash      = hash === '/dashboard' || hash === '/blood' || hash === '/oxygen';
  const isRecept    = hash === '/receptionist';
  return (
    <nav className="topnav">
      <div className="topnav-brand" onClick={() => navigate('/')}>
        <div className="topnav-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round">
            <path d="M12 3v18M3 12h18"/>
          </svg>
        </div>
        <div>
          <div className="topnav-title">MediCore</div>
          {hospitalName && <div className="topnav-sub">{hospitalName}</div>}
        </div>
      </div>

      <div className="topnav-links">
        <button className={`topnav-link ${isPublic ? 'topnav-link-active' : ''}`}
          onClick={() => navigate('/')}>
          Hospitals
        </button>
        {authenticated && (
          <>
            <button className={`topnav-link ${isDash ? 'topnav-link-active' : ''}`}
              onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button className={`topnav-link ${isRecept ? 'topnav-link-active' : ''}`}
              onClick={() => navigate('/receptionist')}>
              Reception
            </button>
          </>
        )}
      </div>

      <div className="topnav-right">
        {authenticated ? (
          <button className="signout-btn" onClick={onLogout}>
            <LogOut size={14}/> Sign Out
          </button>
        ) : (
          <button className="signin-btn" onClick={() => navigate('/auth')}>
            <Building2 size={14}/> Hospital Login
          </button>
        )}
      </div>
    </nav>
  );
}

/* ─── Public Hospital List ───────────────────────────────────────── */
function PublicHospitalList({ navigate }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [live,      setLive]      = useState(false);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getPublicHospitals();
      setHospitals(data);
      setLive(true);
    } catch { /* retry on next poll */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, POLL_INTERVAL); return () => clearInterval(t); }, [load]);

  const totalBeds  = hospitals.reduce((s,h) => s + (h.total_icu_beds||0),     0);
  const freeBeds   = hospitals.reduce((s,h) => s + (h.available_icu_beds||0), 0);
  const filtered   = search ? hospitals.filter(h =>
    h.hospital_name.toLowerCase().includes(search.toLowerCase()) ||
    h.hospital_address?.toLowerCase().includes(search.toLowerCase())
  ) : hospitals;

  if (loading) return (
    <div className="center-state">
      <Loader2 size={32} className="spin-icon" strokeWidth={1.5}/>
      <p className="muted-text">Loading hospitals…</p>
    </div>
  );

  return (
    <div>
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-left">
          <div className="hero-badge">Live ICU Tracking</div>
          <h1 className="hero-title">Smart Emergency<br/><span>Hospital Routing</span></h1>
          <p className="hero-sub">
            Real-time ICU bed availability and ambulance routing — helping every second count in emergencies.
          </p>
          <div className="hero-actions">
            <button className="hero-primary-btn" onClick={() => navigate('/auth')}>Find ICU Now</button>
            <button className="hero-secondary-btn" onClick={() => navigate('/auth')}>Register Hospital</button>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-visual">
            <div className="hero-visual-inner"><Building2 size={72} strokeWidth={1}/></div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="home-stats">
        <div className="home-stat-card">
          <div className="home-stat-icon"><Building2 size={22}/></div>
          <div className="home-stat-num">{hospitals.length || '0'}</div>
          <div className="home-stat-lbl">Hospitals</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-icon"><BedDouble size={22}/></div>
          <div className="home-stat-num">{totalBeds}</div>
          <div className="home-stat-lbl">ICU Beds</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-icon"><CheckCircle2 size={22}/></div>
          <div className="home-stat-num" style={{color:'var(--success)'}}>{freeBeds}</div>
          <div className="home-stat-lbl">Available Now</div>
        </div>
      </div>

      {/* Hospital grid */}
      <div className="content-wrap">
        <div className="content-header">
          <div>
            <h2 className="content-title">ICU Availability</h2>
            <p className="content-sub">Live bed status across all registered hospitals — click a card for details</p>
          </div>
          {live && <span className="live-pill">Live</span>}
        </div>

        {/* Search */}
        <div style={{position:'relative',maxWidth:400}}>
          <input
            style={{width:'100%',padding:'10px 16px 10px 42px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-pill)',fontSize:'.9rem',background:'var(--bg-card)',color:'var(--txt)',transition:'var(--t)'}}
            placeholder="Search hospitals or location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => { e.target.style.borderColor='var(--primary)'; e.target.style.boxShadow='0 0 0 3px var(--primary-light)'; }}
            onBlur={e  => { e.target.style.borderColor='var(--border)';  e.target.style.boxShadow='none'; }}
          />
          <svg style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'var(--txt-3)'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-box">
            <Building2 size={52} className="empty-box-icon" strokeWidth={1}/>
            <p className="empty-box-text">{search ? 'No hospitals match your search.' : 'No hospitals registered yet.'}</p>
          </div>
        ) : (
          <div className="hosp-grid">
            {filtered.map(h => {
              const status   = icuStatus(h.available_icu_beds, h.total_icu_beds);
              const occupied = h.total_icu_beds - h.available_icu_beds;
              const pct      = h.total_icu_beds ? Math.round((occupied/h.total_icu_beds)*100) : 0;
              const fillColor = pct>=75 ? 'var(--danger)' : pct>=50 ? 'var(--warning)' : 'var(--success)';
              const specs = Array.isArray(h.specialties) ? h.specialties : (h.specialties||'').split(',').map(s=>s.trim()).filter(Boolean);
              return (
                <div className="hcard" key={h.id} onClick={() => navigate(`/hospital/${h.id}`)}>
                  <div className="hcard-head">
                    <h3 className="hcard-name">{h.hospital_name}</h3>
                    <span className={`icu-badge ${status.cls}`}>{status.label}</span>
                  </div>
                  <p className="hcard-addr"><MapPin size={13} strokeWidth={2}/>{h.hospital_address}</p>
                  <div className="hcard-progress">
                    <div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`,background:fillColor}}/></div>
                    <div className="progress-meta"><span>{pct}% occupied</span><span>{h.available_icu_beds} / {h.total_icu_beds} free</span></div>
                  </div>
                  <div className="hcard-stats">
                    <div className="hcard-stat"><span className="hstat-val">{h.total_icu_beds}</span><span className="hstat-lbl">Total</span></div>
                    <div className="hcard-stat"><span className="hstat-val" style={{color:'var(--success)'}}>{h.available_icu_beds}</span><span className="hstat-lbl">Free</span></div>
                    <div className="hcard-stat"><span className="hstat-val" style={{color:'var(--purple)'}}>{occupied}</span><span className="hstat-lbl">Occupied</span></div>
                  </div>
                  {specs.length > 0 && (
                    <div className="chip-row">
                      {specs.slice(0,4).map(s=><span className="chip" key={s}>{s}</span>)}
                      {specs.length>4 && <span className="chip chip-more">+{specs.length-4}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Hospital Detail Page ───────────────────────────────────────── */
function HospitalDetail({ hospitalId, navigate }) {
  const [hospital, setHospital] = useState(null);
  const [doctors,  setDoctors]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      getPublicHospitals().then(list => list.find(x => String(x.id) === String(hospitalId)) || null),
      getPublicDoctors(hospitalId).catch(() => []),
    ]).then(([h, docs]) => {
      setHospital(h);
      setDoctors(docs);
    }).finally(() => setLoading(false));
  }, [hospitalId]);

  if (loading) return <div className="center-state"><Loader2 size={28} className="spin-icon" strokeWidth={1.5}/></div>;
  if (!hospital) return (
    <div className="center-state">
      <Building2 size={48} strokeWidth={1} style={{color:'var(--border)'}}/>
      <p className="muted-text">Hospital not found.</p>
      <button className="detail-back-btn" onClick={() => navigate('/')} style={{background:'var(--primary-light)',color:'var(--primary)',border:'none'}}>← Back to list</button>
    </div>
  );

  const status   = icuStatus(hospital.available_icu_beds, hospital.total_icu_beds);
  const occupied = hospital.total_icu_beds - hospital.available_icu_beds;
  const specs    = Array.isArray(hospital.specialties)
    ? hospital.specialties
    : (hospital.specialties||'').split(',').map(s=>s.trim()).filter(Boolean);

  return (
    <div className="detail-wrap">
      {/* Hero banner */}
      <div className="detail-hero">
        <div className="detail-hero-left">
          <button className="detail-back-btn" onClick={() => navigate('/')}>
            <ChevronLeft size={16}/> All Hospitals
          </button>
          <h1 className="detail-hospital-name" style={{marginTop:16}}>{hospital.hospital_name}</h1>
          {hospital.hospital_address && (
            <p className="detail-addr"><MapPin size={15}/>{hospital.hospital_address}</p>
          )}
          <div className="detail-stats-row">
            <div className="detail-stat"><span className="detail-stat-val">{hospital.total_icu_beds}</span><span className="detail-stat-lbl">Total ICU</span></div>
            <div className="detail-stat"><span className="detail-stat-val">{hospital.available_icu_beds}</span><span className="detail-stat-lbl">Available</span></div>
            <div className="detail-stat"><span className="detail-stat-val">{occupied}</span><span className="detail-stat-lbl">Occupied</span></div>
          </div>
        </div>
        <div className="detail-hero-right">
          <span className={`icu-badge ${status.cls}`} style={{fontSize:'.85rem',padding:'6px 16px'}}>{status.label}</span>
          <button className="detail-book-btn" onClick={() => navigate(`/book/${hospital.id}`)}>
            <Calendar size={16}/> Book Appointment
          </button>
        </div>
      </div>

      {/* Specialties */}
      {specs.length > 0 && (
        <div>
          <h2 className="section-heading">Specialties</h2>
          <div className="chip-row">{specs.map(s=><span className="chip" key={s}>{s}</span>)}</div>
        </div>
      )}

      {/* Doctors */}
      <div>
        <h2 className="section-heading">Our Doctors</h2>
        {doctors.length === 0 ? (
          <p className="muted-text" style={{textAlign:'center',padding:'32px 0'}}>No doctors listed yet.</p>
        ) : (
          <div className="doctor-grid">
            {doctors.map((doc,i) => (
              <div className="doctor-card" key={doc.id} style={{animationDelay:`${i*0.08}s`}}>
                <div className="doctor-info">
                  <div className="doctor-avatar">{avatarLetter(doc.name)}</div>
                  <div>
                    <p className="doctor-name">{doc.name}</p>
                    <p className="doctor-spec">{doc.specialty}</p>
                  </div>
                </div>
                <div className="doctor-meta">
                  {doc.qualification && <div className="doctor-meta-row"><BookOpen size={13}/> {doc.qualification}</div>}
                  <div className="doctor-meta-row"><Award size={13}/> {doc.experience_years} yr{doc.experience_years!==1?'s':''} experience</div>
                  {doc.availability && <div className="doctor-meta-row"><Clock size={13}/> {doc.availability}</div>}
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
                  <span className={`icu-badge ${doc.is_available ? 'badge-success' : 'badge-muted'}`} style={{fontSize:'.72rem'}}>
                    {doc.is_available ? 'Available' : 'Unavailable'}
                  </span>
                  <button className="doc-book-btn" onClick={() => navigate(`/book/${hospital.id}`)}>
                    <Calendar size={15}/> Book Appointment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Book Appointment Page ──────────────────────────────────────── */
function BookAppointment({ hospitalId, navigate }) {
  const [hospital, setHospital] = useState(null);
  const [doctors,  setDoctors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success,  setSuccess]  = useState(null); // token string when done
  const [form, setForm] = useState({
    patientName:'', email:'', phone:'',
    doctor:'', date:'', time:'', symptoms:'',
  });

  useEffect(() => {
    Promise.all([
      getPublicHospitals().then(list => list.find(x => String(x.id) === String(hospitalId)) || null),
      getPublicDoctors(hospitalId).catch(() => []),
    ]).then(([h, docs]) => {
      setHospital(h);
      setDoctors(docs);
    }).finally(() => setLoading(false));
  }, [hospitalId]);

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r=>setTimeout(r,900)); // simulate network
    const token = `MCT-${Date.now().toString(36).toUpperCase()}`;
    const appt = {
      id: token, hospitalId, hospitalName: hospital?.hospital_name,
      ...form, status:'pending', createdAt: new Date().toISOString(),
    };
    const all = loadAppointments();
    all.push(appt);
    saveAppointments(all);
    setSubmitting(false);
    setSuccess(token);
  };

  if (loading) return <div className="center-state"><Loader2 size={28} className="spin-icon" strokeWidth={1.5}/></div>;

  if (success) return (
    <div className="book-wrap">
      <div className="book-card">
        <div className="book-success">
          <div className="book-success-icon"><CheckCircle2 size={38}/></div>
          <h2 className="book-success-title">Appointment Requested!</h2>
          <p className="book-success-sub">Your appointment has been submitted to {hospital?.hospital_name}. You'll receive a confirmation email shortly.</p>
          <div className="book-token">Token: {success}</div>
          <button className="detail-book-btn" style={{marginTop:8}} onClick={() => navigate(`/hospital/${hospitalId}`)}>← Back to Hospital</button>
        </div>
      </div>
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="book-wrap">
      <div className="book-card">
        <button className="detail-back-btn" style={{background:'var(--primary-light)',color:'var(--primary)',border:'none',marginBottom:20}} onClick={() => navigate(`/hospital/${hospitalId}`)}>
          <ChevronLeft size={15}/> Back
        </button>
        <h2 className="book-title">Book Appointment</h2>
        <p className="book-sub">at {hospital?.hospital_name || 'Hospital'}</p>
        <form className="book-form" onSubmit={handleSubmit}>
          <div className="book-row2">
            <div className="book-field">
              <label className="book-label">Patient Name *</label>
              <input className="book-input" required placeholder="Full name" value={form.patientName} onChange={e=>set('patientName',e.target.value)}/>
            </div>
            <div className="book-field">
              <label className="book-label">Phone *</label>
              <input className="book-input" required type="tel" placeholder="+91 98765…" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
            </div>
          </div>
          <div className="book-field">
            <label className="book-label">Email Address *</label>
            <input className="book-input" required type="email" placeholder="you@example.com" value={form.email} onChange={e=>set('email',e.target.value)}/>
          </div>
          <div className="book-field">
            <label className="book-label">Select Doctor *</label>
            <select className="book-select" required value={form.doctor} onChange={e=>set('doctor',e.target.value)}>
              <option value="">— Choose Doctor —</option>
              {doctors.map(d=><option key={d.id} value={d.name}>{d.name} ({d.specialty})</option>)}
            </select>
          </div>
          <div className="book-row2">
            <div className="book-field">
              <label className="book-label">Preferred Date *</label>
              <input className="book-input" required type="date" min={today} value={form.date} onChange={e=>set('date',e.target.value)}/>
            </div>
            <div className="book-field">
              <label className="book-label">Preferred Time *</label>
              <select className="book-select" required value={form.time} onChange={e=>set('time',e.target.value)}>
                <option value="">— Select Time —</option>
                {['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="book-field">
            <label className="book-label">Symptoms / Reason for Visit</label>
            <textarea className="book-textarea" placeholder="Describe your symptoms or the reason for visiting…" value={form.symptoms} onChange={e=>set('symptoms',e.target.value)}/>
          </div>
          <button className="book-submit" type="submit" disabled={submitting}>
            {submitting ? <><Loader2 size={18} className="spin-icon"/> Submitting…</> : 'Request Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Hospital Dashboard ─────────────────────────────────────────── */
const BED_ACTIONS = [
  { mode:'add',     label:'Add Beds',      cls:'bact-primary'   },
  { mode:'remove',  label:'Remove Beds',   cls:'bact-secondary' },
  { mode:'occupy',  label:'Mark Occupied', cls:'bact-warn'      },
  { mode:'release', label:'Mark Available',cls:'bact-success'   },
  { mode:'set',     label:'Set Available', cls:'bact-secondary' },
];

function StatCard({ icon: Icon, val, lbl, mod }) {
  return (
    <div className={`sc ${mod}`}>
      <span className="sc-icon"><Icon size={22} strokeWidth={1.8}/></span>
      <div><div className="sc-val">{val}</div><div className="sc-lbl">{lbl}</div></div>
    </div>
  );
}

/* ─── Doctors Panel (dashboard section) ─────────────────────────── */
function DoctorsPanel() {
  const EMPTY = { name:'', specialty:'', qualification:'', experience_years:0, availability:'', is_available:true };
  const [doctors,   setDoctors]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [formError, setFormError] = useState('');
  const [form,      setForm]      = useState(EMPTY);

  useEffect(() => {
    getMyDoctors().then(setDoctors).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const startAdd = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); setFormError(''); };
  const startEdit = (doc) => {
    setForm({ name:doc.name, specialty:doc.specialty, qualification:doc.qualification, experience_years:doc.experience_years, availability:doc.availability, is_available:doc.is_available });
    setEditingId(doc.id); setShowForm(true); setFormError('');
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setFormError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setFormError('');
    try {
      const payload = { ...form, experience_years: Number(form.experience_years) };
      if (editingId) {
        const updated = await updateDoctor(editingId, payload);
        setDoctors(prev => prev.map(d => d.id === editingId ? updated : d));
      } else {
        const created = await createDoctor(payload);
        setDoctors(prev => [...prev, created]);
      }
      setShowForm(false); setEditingId(null);
    } catch (err) {
      setFormError(err.message || 'Failed to save doctor');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Remove this doctor?')) return;
    try {
      await deleteDoctor(docId);
      setDoctors(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      setFormError(err.message || 'Failed to delete doctor');
    }
  };

  return (
    <div className="dash-section">
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Doctors</h2>
          <button className="btn-primary" onClick={startAdd}><Plus size={15}/> Add Doctor</button>
        </div>

        {formError && <div className="form-error" style={{marginBottom:12,color:'var(--danger)',fontSize:'.85rem'}}>{formError}</div>}

        {showForm && (
          <form className="doctor-mgmt-form" onSubmit={handleSubmit}>
            <div className="bedmgmt" style={{flexWrap:'wrap',gap:12}}>
              <div className="form-group" style={{flex:'1 1 200px'}}>
                <label className="count-label">Full Name *</label>
                <input className="count-input" style={{width:'100%'}} required placeholder="Dr. Full Name" value={form.name} onChange={e=>setField('name',e.target.value)}/>
              </div>
              <div className="form-group" style={{flex:'1 1 200px'}}>
                <label className="count-label">Specialty *</label>
                <input className="count-input" style={{width:'100%'}} required placeholder="e.g. Cardiology" value={form.specialty} onChange={e=>setField('specialty',e.target.value)}/>
              </div>
            </div>
            <div className="form-group" style={{marginTop:12}}>
              <label className="count-label">Qualification / Studies</label>
              <input className="count-input" style={{width:'100%'}} placeholder="e.g. MBBS, MD Cardiology — AIIMS Delhi" value={form.qualification} onChange={e=>setField('qualification',e.target.value)}/>
            </div>
            <div className="bedmgmt" style={{flexWrap:'wrap',gap:12,marginTop:12}}>
              <div className="form-group" style={{flex:'1 1 150px'}}>
                <label className="count-label">Experience (years)</label>
                <input className="count-input" style={{width:'100%'}} type="number" min="0" value={form.experience_years} onChange={e=>setField('experience_years',e.target.value)}/>
              </div>
              <div className="form-group" style={{flex:'1 1 200px'}}>
                <label className="count-label">Availability</label>
                <input className="count-input" style={{width:'100%'}} placeholder="e.g. Mon–Fri 09:00–17:00" value={form.availability} onChange={e=>setField('availability',e.target.value)}/>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:12}}>
              <input type="checkbox" id="doc_avail" checked={form.is_available} onChange={e=>setField('is_available',e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/>
              <label htmlFor="doc_avail" className="count-label" style={{marginBottom:0,cursor:'pointer'}}>Currently Available</label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button type="submit" className="bed-btn bed-btn-occupy" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Update Doctor' : 'Add Doctor'}</button>
              <button type="button" className="bed-btn" style={{background:'var(--bg-2)',color:'var(--txt-2)',border:'1px solid var(--border)'}} onClick={cancelForm}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="center-state"><Loader2 size={24} className="spin-icon" strokeWidth={1.5}/></div>
        ) : doctors.length === 0 && !showForm ? (
          <div className="no-alerts"><Users size={16}/> No doctors added yet. Click "Add Doctor" to get started.</div>
        ) : (
          <div className="doctor-mgmt-grid">
            {doctors.map(doc => (
              <div className="doctor-mgmt-card" key={doc.id}>
                <div className="doctor-info">
                  <div className="doctor-avatar">{avatarLetter(doc.name)}</div>
                  <div style={{flex:1}}>
                    <p className="doctor-name">{doc.name}</p>
                    <p className="doctor-spec">{doc.specialty}</p>
                  </div>
                  <span className={`icu-badge ${doc.is_available ? 'badge-success' : 'badge-muted'}`} style={{fontSize:'.72rem'}}>
                    {doc.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <div className="doctor-meta" style={{marginTop:10}}>
                  {doc.qualification && <div className="doctor-meta-row"><BookOpen size={13}/> {doc.qualification}</div>}
                  <div className="doctor-meta-row"><Award size={13}/> {doc.experience_years} yr{doc.experience_years!==1?'s':''} experience</div>
                  {doc.availability && <div className="doctor-meta-row"><Clock size={13}/> {doc.availability}</div>}
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button className="aact aact-ack" onClick={()=>startEdit(doc)}>Edit</button>
                  <button className="aact aact-cancel" onClick={()=>handleDelete(doc.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HospitalDashboard({ onUnauthorized, navigate, hash }) {
  const [hospital, setHospital] = useState(null);
  const [alerts,   setAlerts]   = useState([]);
  const [count,    setCount]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(null);
  const [error,    setError]    = useState('');
  const [locEdit,  setLocEdit]  = useState({ lat:'', lng:'', busy:false, locating:false });
  const [activeSection, setActiveSection] = useState('overview');

  // ETA alarm
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [alarmActive,    setAlarmActive]    = useState(false);
  const silencedRef  = useRef(new Set());
  const audioCtxRef  = useRef(null);
  const beepTimer    = useRef(null);

  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
      }
      document.removeEventListener('click', unlock, true);
    };
    document.addEventListener('click', unlock, true);
    return () => document.removeEventListener('click', unlock, true);
  }, []);
  useEffect(() => () => { if (beepTimer.current) clearInterval(beepTimer.current); audioCtxRef.current?.close(); }, []);

  function _playBeep() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      if (ctx.state==='suspended') ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t+0.04);
      gain.gain.setValueAtTime(0.4, t+0.18);
      gain.gain.linearRampToValueAtTime(0, t+0.28);
      osc.start(t); osc.stop(t+0.3);
    } catch { /* ignore */ }
  }

  const startBeep = useCallback(() => {
    if (beepTimer.current) return;
    _playBeep(); beepTimer.current = setInterval(_playBeep, 900);
  }, []);
  const stopBeep = useCallback(() => {
    if (beepTimer.current) { clearInterval(beepTimer.current); beepTimer.current = null; }
  }, []);

  const silenceAlarm = () => {
    criticalAlerts.forEach(a => silencedRef.current.add(a.id));
    setCriticalAlerts([]); setAlarmActive(false); stopBeep();
  };

  const refresh = useCallback(async () => {
    try {
      const [me, incoming] = await Promise.all([getHospitalMe(), getHospitalAlerts()]);
      setHospital(me); setAlerts(incoming);
      const active = incoming.filter(a => (a.status==='reserved'||a.status==='acknowledged') && a.eta < 5);
      const activeIds = new Set(active.map(a=>a.id));
      silencedRef.current = new Set([...silencedRef.current].filter(id=>activeIds.has(id)));
      const unsilenced = active.filter(a=>!silencedRef.current.has(a.id));
      setCriticalAlerts(unsilenced);
      if (unsilenced.length > 0) { setAlarmActive(true); startBeep(); }
      else { setAlarmActive(false); stopBeep(); }
    } catch (err) {
      if (err.status===401) { onUnauthorized?.(); return; }
      setError(err.message||'Failed to load data');
    } finally { setLoading(false); }
  }, [onUnauthorized, startBeep, stopBeep]);

  useEffect(() => { refresh(); const t = setInterval(refresh, POLL_INTERVAL); return () => clearInterval(t); }, [refresh]);

  const runBedAction = async (mode) => {
    setBusy(mode); setError('');
    try { const next = await updateHospitalIcu(mode, Number(count)||1); setHospital(next); }
    catch (err) { setError(err.message||'Action failed'); }
    finally { setBusy(null); }
  };

  const handleAlert = async (id, status) => {
    try { await updateAlertStatus(id, status); refresh(); }
    catch (err) { setError(err.message||'Failed to update alert'); }
  };

  const detectGps = () => {
    setLocEdit(p=>({...p,locating:true}));
    navigator.geolocation.getCurrentPosition(
      pos => setLocEdit(p=>({...p,lat:String(pos.coords.latitude),lng:String(pos.coords.longitude),locating:false})),
      ()  => setLocEdit(p=>({...p,locating:false})),
    );
  };
  const saveLocation = async () => {
    const lat=Number(locEdit.lat), lng=Number(locEdit.lng);
    if (!locEdit.lat||!locEdit.lng||isNaN(lat)||isNaN(lng)) return;
    setLocEdit(p=>({...p,busy:true}));
    try { const next = await updateHospitalLocation(lat,lng); setHospital(next); }
    catch (err) { setError(err.message||'Failed to update location'); }
    finally { setLocEdit(p=>({...p,busy:false})); }
  };

  if (loading) return <div className="center-state"><Loader2 size={32} className="spin-icon" strokeWidth={1.5}/><p className="muted-text">Loading dashboard…</p></div>;

  const occupied = hospital ? hospital.total_icu_beds - hospital.available_icu_beds : 0;
  const pct      = hospital?.total_icu_beds ? Math.round((occupied/hospital.total_icu_beds)*100) : 0;
  const status   = hospital ? icuStatus(hospital.available_icu_beds, hospital.total_icu_beds) : null;
  const fillColor = pct>=75 ? 'var(--danger)' : pct>=50 ? 'var(--warning)' : 'var(--success)';
  const pending = alerts.filter(a=>a.status==='pending');
  const rest    = alerts.filter(a=>a.status!=='pending');

  const sections = [
    { id:'overview', label:'Dashboard',        Icon:LayoutDashboard },
    { id:'beds',     label:'ICU Beds',          Icon:BedDouble },
    { id:'alerts',   label:'Emergency Alerts',  Icon:Bell, badge:pending.length },
    { id:'doctors',  label:'Doctors',           Icon:Stethoscope },
    { id:'location', label:'Settings',          Icon:Settings },
  ];

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
          </div>
          <span className="sidebar-brandname">MediCore</span>
        </div>
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Navigation</span>
          {sections.map(s=>(
            <button key={s.id} className={`sidebar-item ${activeSection===s.id?'active':''}`} onClick={()=>setActiveSection(s.id)}>
              <s.Icon size={18}/>
              <span>{s.label}</span>
              {s.badge>0 && <span className="sidebar-badge">{s.badge}</span>}
            </button>
          ))}
          <span className="sidebar-section-label" style={{marginTop:12}}>Staff</span>
          <button className="sidebar-item" onClick={()=>navigate('/blood')}>
            <Droplets size={18}/><span>Blood Bank</span>
          </button>
          <button className="sidebar-item" onClick={()=>navigate('/oxygen')}>
            <Wind size={18}/><span>Oxygen</span>
          </button>
          <button className="sidebar-item" onClick={()=>navigate('/receptionist')}>
            <Calendar size={18}/><span>Reception</span>
          </button>
        </nav>
        <button className="sidebar-logout" onClick={onUnauthorized}>
          <LogOut size={16}/><span>Logout</span>
        </button>
      </aside>

      <main className="dash-main">
        <div className="dash-content">
          {error && (
            <div className="error-toast" role="alert" onClick={()=>setError('')}>
              <span className="toast-inner"><AlertTriangle size={16}/>{error}</span>
              <XCircle size={16}/>
            </div>
          )}
          {alarmActive && criticalAlerts.length>0 && (
            <div className="eta-alarm-beam" role="alert" aria-live="assertive">
              <div className="eta-alarm-icon"><Bell size={28} strokeWidth={2.5}/></div>
              <div className="eta-alarm-body">
                <div className="eta-alarm-title">AMBULANCE ARRIVING IN UNDER 5 MINUTES</div>
                <div className="eta-alarm-details">
                  {criticalAlerts.map(a=>(
                    <span key={a.id} className="eta-alarm-chip">{a.severity} · ETA {Math.round(a.eta)} min · {a.blood_group}</span>
                  ))}
                </div>
              </div>
              <button className="eta-alarm-silence" onClick={silenceAlarm}>
                <BellOff size={16}/> Silence Alarm
              </button>
            </div>
          )}

          {hospital && (
            <>
              {/* Overview */}
              {activeSection==='overview' && (
                <div className="dash-section">
                  <div className="dash-banner">
                    <div>
                      <div className="dash-name-row">
                        <h1 className="dash-name">{hospital.hospital_name}</h1>
                        {status && <span className={`icu-badge ${status.cls}`}>{status.label}</span>}
                      </div>
                      <p className="dash-addr"><MapPin size={14}/>{hospital.hospital_address}</p>
                    </div>
                    <div className="dash-live"><span className="live-dot"/><span>Live</span></div>
                  </div>
                  <div className="stat-row">
                    <StatCard icon={BedDouble}    val={hospital.total_icu_beds}     lbl="Total Beds"     mod=""/>
                    <StatCard icon={CheckCircle2} val={hospital.available_icu_beds} lbl="Available"      mod="sc-success"/>
                    <StatCard icon={XCircle}      val={occupied}                   lbl="Occupied"       mod="sc-plum"/>
                    <StatCard icon={Bell}         val={pending.length}              lbl="Pending Alerts" mod="sc-warn"/>
                  </div>
                  <div className="panel">
                    <div className="panel-head">
                      <h2 className="panel-title">ICU Occupancy</h2>
                      <span className="pct-chip">{pct}%</span>
                    </div>
                    <div className="occ-bar"><div className="occ-fill" style={{width:`${pct}%`,background:fillColor}}/></div>
                    <div className="occ-labels"><span>{hospital.available_icu_beds} available</span><span>{occupied} occupied of {hospital.total_icu_beds}</span></div>
                  </div>
                </div>
              )}

              {/* ICU Beds */}
              {activeSection==='beds' && (
                <div className="dash-section">
                  <div className="panel">
                    <h2 className="panel-title" style={{marginBottom:22}}>Bed Management</h2>
                    <div className="bedmgmt">
                      <div className="bedmgmt-count">
                        <label className="count-label">Count</label>
                        <input className="count-input" type="number" min="1" value={count}
                          onChange={e=>setCount(Math.max(1,Number(e.target.value)))}/>
                      </div>
                      <div className="bedmgmt-actions">
                        {BED_ACTIONS.map(({mode,label,cls})=>(
                          <button key={mode} className={`bact ${cls}`}
                            onClick={()=>runBedAction(mode)} disabled={busy!==null}>
                            {busy===mode ? <Loader2 size={14} className="spin-icon"/> : label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings / Location */}
              {activeSection==='location' && (
                <div className="dash-section">
                  <div className="panel">
                    <h2 className="panel-title" style={{marginBottom:12}}>Hospital Location</h2>
                    {hospital.latitude && (
                      <p className="muted-text" style={{marginBottom:14,fontSize:'.82rem'}}>
                        Current: {Number(hospital.latitude).toFixed(6)}°N, {Number(hospital.longitude).toFixed(6)}°E
                      </p>
                    )}
                    <div className="bedmgmt">
                      <div style={{display:'flex',gap:8,flex:1}}>
                        <input className="count-input" style={{width:140}} type="number" step="any" placeholder="Latitude" value={locEdit.lat}
                          onChange={e=>setLocEdit(p=>({...p,lat:e.target.value}))}/>
                        <input className="count-input" style={{width:140}} type="number" step="any" placeholder="Longitude" value={locEdit.lng}
                          onChange={e=>setLocEdit(p=>({...p,lng:e.target.value}))}/>
                      </div>
                      <div className="bedmgmt-actions">
                        <button className="bact bact-secondary" onClick={detectGps} disabled={locEdit.locating}>
                          {locEdit.locating ? <Loader2 size={14} className="spin-icon"/> : <><Navigation size={14}/> GPS</>}
                        </button>
                        <button className="bact bact-primary" onClick={saveLocation} disabled={locEdit.busy||(!locEdit.lat&&!locEdit.lng)}>
                          {locEdit.busy ? <Loader2 size={14} className="spin-icon"/> : 'Save Location'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Alerts */}
          {activeSection==='alerts' && (
            <div className="dash-section">
              <div className="panel">
                <div className="panel-head">
                  <h2 className="panel-title">Incoming Ambulance Alerts</h2>
                  {pending.length>0 && <span className="pending-badge">{pending.length} pending</span>}
                </div>
                {alerts.length===0 ? (
                  <div className="no-alerts"><CheckCircle2 size={16}/> No active alerts right now</div>
                ) : (
                  <div className="alerts-stack">
                    {[...pending,...rest].map(a=>(
                      <div className={`acard ${severityCls(a.severity)}`} key={a.id}>
                        <div className="acard-top">
                          <div className="acard-chips">
                            <span className={`sev-tag sev-tag-${(a.severity||'').toLowerCase()}`}>{a.severity||'Unknown'}</span>
                            <span className="info-chip"><Clock size={12}/>{Math.round(a.eta)} min ETA</span>
                            <span className="info-chip"><Droplets size={12}/>{a.blood_group}</span>
                            <span className="info-chip"><Activity size={12}/>O₂ {a.oxygen_level}%</span>
                          </div>
                          <span className={`status-tag st-${a.status}`}>{a.status}</span>
                        </div>
                        {a.patient_condition_notes && (
                          <p className="acard-notes"><FileText size={13}/>{a.patient_condition_notes}</p>
                        )}
                        {a.status==='pending' && (
                          <div className="acard-actions">
                            <button className="aact aact-ack"    onClick={()=>handleAlert(a.id,'acknowledged')}>Acknowledge</button>
                            <button className="aact aact-done"   onClick={()=>handleAlert(a.id,'completed')}>Complete</button>
                            <button className="aact aact-cancel" onClick={()=>handleAlert(a.id,'cancelled')}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Doctors */}
          {activeSection==='doctors' && <DoctorsPanel/>}
        </div>
      </main>
    </div>
  );
}

/* ─── Blood Bank Page ────────────────────────────────────────────── */
function BloodBankPage({ navigate }) {
  const [bank,    setBank]    = useState(loadBloodBank);
  const [qty,     setQty]     = useState(() => Object.fromEntries(BLOOD_TYPES.map(t=>[t,1])));

  const mutate = (type, delta) => {
    setBank(prev => {
      const next = { ...prev, [type]: { units: Math.max(0, prev[type].units+delta), updated: new Date().toISOString() } };
      saveBloodBank(next); return next;
    });
  };

  return (
    <div className="content-wrap">
      <div className="content-header">
        <div>
          <h2 className="content-title" style={{display:'flex',alignItems:'center',gap:10}}>
            <Droplets size={28} color="var(--danger)"/> Blood Bank Inventory
          </h2>
          <p className="content-sub">Hospital staff view — manage blood unit availability</p>
        </div>
        <button className="detail-back-btn" style={{background:'var(--primary-light)',color:'var(--primary)',border:'none'}}
          onClick={()=>navigate('/dashboard')}>
          <ChevronLeft size={15}/> Dashboard
        </button>
      </div>
      <div className="blood-grid">
        {BLOOD_TYPES.map(type=>{
          const item  = bank[type];
          const level = item.units === 0 ? 'blood-critical' : item.units < 5 ? 'blood-low' : '';
          return (
            <div className={`blood-card ${level}`} key={type}>
              <div className="blood-type-badge">{type}</div>
              <div>
                <div className="blood-units">{item.units}</div>
                <div className="blood-unit-lbl">units available</div>
              </div>
              <div className="blood-updated">Updated: {formatDate(item.updated)}</div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="number" min="1" max="50" value={qty[type]}
                  onChange={e=>setQty(p=>({...p,[type]:Math.max(1,Number(e.target.value))}))}
                  style={{width:56,padding:'6px 8px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:'.9rem',textAlign:'center'}}/>
                <div className="blood-actions">
                  <button className="blood-btn blood-btn-add" onClick={()=>mutate(type,+qty[type])}>+ Add</button>
                  <button className="blood-btn blood-btn-use" onClick={()=>mutate(type,-qty[type])}>− Use</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Oxygen Management Page ─────────────────────────────────────── */
function OxygenPage({ navigate }) {
  const [oxy, setOxy] = useState(loadOxygen);

  const mutateOxy = (fn) => { setOxy(prev => { const next = fn(prev); saveOxygen(next); return next; }); };

  const addCylinder = ()  => mutateOxy(p=>({...p,total:p.total+1,available:p.available+1}));
  const markInUse   = ()  => {
    if (oxy.available < 1) return;
    mutateOxy(p=>({...p,available:p.available-1,inUse:p.inUse+1}));
  };
  const refill = ()  => {
    if (oxy.inUse < 1) return;
    mutateOxy(p=>({...p,available:p.available+1,inUse:p.inUse-1}));
  };

  return (
    <div className="content-wrap">
      <div className="content-header">
        <div>
          <h2 className="content-title" style={{display:'flex',alignItems:'center',gap:10}}>
            <Wind size={28} color="var(--primary)"/> Oxygen Management
          </h2>
          <p className="content-sub">Track and manage medical oxygen cylinder inventory</p>
        </div>
        <button className="detail-back-btn" style={{background:'var(--primary-light)',color:'var(--primary)',border:'none'}}
          onClick={()=>navigate('/dashboard')}>
          <ChevronLeft size={15}/> Dashboard
        </button>
      </div>

      <div className="oxygen-summary">
        <div className="oxygen-card">
          <div className="oxygen-icon" style={{background:'var(--primary-light)',color:'var(--primary)'}}><Wind size={26}/></div>
          <div className="oxygen-val">{oxy.total}</div>
          <div className="oxygen-lbl">Total Cylinders</div>
        </div>
        <div className="oxygen-card">
          <div className="oxygen-icon" style={{background:'var(--success-bg)',color:'var(--success)'}}><CheckCircle2 size={26}/></div>
          <div className="oxygen-val" style={{color:'var(--success)'}}>{oxy.available}</div>
          <div className="oxygen-lbl">Available</div>
        </div>
        <div className="oxygen-card">
          <div className="oxygen-icon" style={{background:'var(--warning-bg)',color:'var(--warning)'}}><Activity size={26}/></div>
          <div className="oxygen-val" style={{color:'var(--warning)'}}>{oxy.inUse}</div>
          <div className="oxygen-lbl">In Use</div>
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Cylinder Usage</h2>
          <span className="pct-chip">{oxy.total ? Math.round((oxy.inUse/oxy.total)*100) : 0}% in use</span>
        </div>
        <div className="occ-bar">
          <div className="occ-fill" style={{
            width: oxy.total ? `${(oxy.inUse/oxy.total)*100}%` : '0%',
            background: oxy.inUse/oxy.total >= 0.75 ? 'var(--danger)' : oxy.inUse/oxy.total >= 0.5 ? 'var(--warning)' : 'var(--success)',
          }}/>
        </div>
        <div className="occ-labels"><span>{oxy.available} available</span><span>{oxy.inUse} in use of {oxy.total}</span></div>
      </div>

      {/* Actions */}
      <div className="panel">
        <h2 className="panel-title" style={{marginBottom:20}}>Actions</h2>
        <div className="oxygen-actions">
          <button className="oxy-btn oxy-btn-primary" onClick={addCylinder}>
            <Plus size={16}/> Add Cylinder
          </button>
          <button className="oxy-btn oxy-btn-warn" onClick={markInUse} disabled={oxy.available<1}>
            <Activity size={16}/> Mark In Use
          </button>
          <button className="oxy-btn oxy-btn-secondary" onClick={refill} disabled={oxy.inUse<1}>
            <CheckCircle2 size={16}/> Refill / Return
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Receptionist Dashboard ─────────────────────────────────────── */
const EMAIL_TEMPLATES = {
  confirmed: (a) => `Subject: Appointment Confirmed — MediCore\n\nDear ${a.patientName},\n\nYour appointment has been confirmed.\n\nDoctor:     ${a.doctor}\nHospital:   ${a.hospitalName}\nDate:       ${a.date}\nTime:       ${a.time}\nToken No.:  ${a.id}\n\nPlease arrive 10 minutes early.\n\nRegards,\nMediCore Hospital Platform`,
  postponed: (a,d,t) => `Subject: Appointment Rescheduled — MediCore\n\nDear ${a.patientName},\n\nYour appointment has been rescheduled.\n\nNew Date:  ${d}\nNew Time:  ${t}\nDoctor:    ${a.doctor}\nHospital:  ${a.hospitalName}\n\nWe apologise for any inconvenience.\n\nRegards,\nMediCore Hospital Platform`,
  declined:  (a) => `Subject: Appointment Request Update — MediCore\n\nDear ${a.patientName},\n\nUnfortunately, we were unable to schedule your appointment at this time with ${a.doctor} at ${a.hospitalName}.\n\nPlease contact our reception to reschedule at your earliest convenience.\n\nRegards,\nMediCore Hospital Platform`,
};

function ReceptionistDashboard({ navigate }) {
  const [appointments, setAppointments] = useState(loadAppointments);
  const [emailModal,   setEmailModal]   = useState(null); // { text, title }
  const [postponeModal,setPostponeModal]= useState(null); // { id }
  const [newDate,      setNewDate]      = useState('');
  const [newTime,      setNewTime]      = useState('10:00');

  const update = (id, patch) =>
    setAppointments(prev => {
      const next = prev.map(a => a.id===id ? {...a,...patch} : a);
      saveAppointments(next); return next;
    });

  const approve = (a) => {
    update(a.id, { status:'confirmed' });
    setEmailModal({ title:'Appointment Confirmed', text: EMAIL_TEMPLATES.confirmed(a) });
  };
  const decline = (a) => {
    update(a.id, { status:'declined' });
    setEmailModal({ title:'Appointment Declined', text: EMAIL_TEMPLATES.declined(a) });
  };
  const submitPostpone = (a) => {
    update(a.id, { status:'postponed', date:newDate, time:newTime });
    setEmailModal({ title:'Appointment Rescheduled', text: EMAIL_TEMPLATES.postponed(a,newDate,newTime) });
    setPostponeModal(null); setNewDate(''); setNewTime('10:00');
  };

  const badgeCls = s => ({ pending:'appt-status-pending', confirmed:'appt-status-confirmed', declined:'appt-status-declined', postponed:'appt-status-postponed' }[s] || 'appt-status-pending');

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="content-wrap">
      <div className="content-header">
        <div>
          <h2 className="content-title" style={{display:'flex',alignItems:'center',gap:10}}>
            <Calendar size={26} color="var(--primary)"/> Receptionist Dashboard
          </h2>
          <p className="content-sub">Manage appointment requests from patients</p>
        </div>
      </div>

      {appointments.length===0 ? (
        <div className="empty-box">
          <Calendar size={52} className="empty-box-icon" strokeWidth={1}/>
          <p className="empty-box-text">No appointment requests yet.</p>
          <p className="muted-text" style={{fontSize:'.85rem'}}>Appointments submitted via the patient portal will appear here.</p>
        </div>
      ) : (
        <div className="panel" style={{padding:0,overflow:'hidden'}}>
          <div className="appt-table-wrap">
            <table className="appt-table">
              <thead>
                <tr>
                  <th>Token</th><th>Patient</th><th>Doctor</th><th>Hospital</th>
                  <th>Date</th><th>Time</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...appointments].reverse().map(a=>(
                  <tr key={a.id}>
                    <td><code style={{fontSize:'.78rem',color:'var(--txt-3)'}}>{a.id}</code></td>
                    <td>
                      <div style={{fontWeight:600}}>{a.patientName}</div>
                      <div style={{fontSize:'.78rem',color:'var(--txt-3)'}}>{a.email}</div>
                    </td>
                    <td>{a.doctor}</td>
                    <td style={{fontSize:'.85rem',color:'var(--txt-2)'}}>{a.hospitalName}</td>
                    <td style={{whiteSpace:'nowrap'}}>{a.date}</td>
                    <td>{a.time}</td>
                    <td><span className={`appt-status ${badgeCls(a.status)}`}>{a.status}</span></td>
                    <td>
                      {a.status==='pending' && (
                        <div className="appt-actions">
                          <button className="appt-btn appt-btn-approve"  onClick={()=>approve(a)}>Approve</button>
                          <button className="appt-btn appt-btn-postpone" onClick={()=>{setPostponeModal(a);setNewDate(today);}}>Postpone</button>
                          <button className="appt-btn appt-btn-decline"  onClick={()=>decline(a)}>Decline</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Postpone modal */}
      {postponeModal && (
        <div className="modal-overlay" onClick={()=>setPostponeModal(null)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h2 className="modal-title">Reschedule Appointment</h2>
            <p className="modal-sub">Select a new date and time for {postponeModal.patientName}</p>
            <div className="book-row2" style={{marginBottom:20}}>
              <div className="book-field">
                <label className="book-label">New Date</label>
                <input className="book-input" type="date" min={today} value={newDate} onChange={e=>setNewDate(e.target.value)}/>
              </div>
              <div className="book-field">
                <label className="book-label">New Time</label>
                <select className="book-select" value={newTime} onChange={e=>setNewTime(e.target.value)}>
                  {['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={()=>setPostponeModal(null)}>Cancel</button>
              <button className="bact bact-warn" onClick={()=>submitPostpone(postponeModal)} disabled={!newDate}>Reschedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Email preview modal */}
      {emailModal && (
        <div className="modal-overlay" onClick={()=>setEmailModal(null)}>
          <div className="modal-card" style={{maxWidth:540}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <Mail size={22} color="var(--primary)"/>
              <h2 className="modal-title" style={{margin:0}}>{emailModal.title}</h2>
            </div>
            <p className="modal-sub" style={{marginBottom:0}}>Email notification preview (would be sent to patient):</p>
            <pre className="email-preview">{emailModal.text}</pre>
            <div className="modal-actions">
              <button className="auth-submit" style={{padding:'10px 24px'}} onClick={()=>setEmailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Admin Dashboard ────────────────────────────────────────────── */
const ADMIN_CREDS = { username: 'teamcypher', password: 'admin123@' };

function AdminDashboard({ navigate }) {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [loginForm,   setLoginForm]   = useState({ username: '', password: '' });
  const [loginError,  setLoginError]  = useState('');

  const [hospitals,   setHospitals]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleted,     setDeleted]     = useState(new Set());

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginForm.username === ADMIN_CREDS.username && loginForm.password === ADMIN_CREDS.password) {
      setLoginError('');
      setAdminAuthed(true);
      setLoading(true);
      getPublicHospitals().then(setHospitals).catch(()=>{}).finally(()=>setLoading(false));
    } else {
      setLoginError('Invalid credentials.');
    }
  };

  const confirmDelete = () => {
    if (deleteInput.trim() !== 'DELETE') return;
    setDeleted(prev => new Set([...prev, deleteModal.id]));
    setDeleteModal(null); setDeleteInput('');
  };

  /* ── Login wall ── */
  if (!adminAuthed) {
    return (
      <div style={{minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div className="modal-card" style={{width:'100%',maxWidth:400}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
            <ShieldCheck size={26} color="var(--primary)"/>
            <h2 className="modal-title" style={{margin:0}}>Admin Access</h2>
          </div>
          <form onSubmit={handleAdminLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{fontSize:'.82rem',fontWeight:600,color:'var(--txt-2)',display:'block',marginBottom:4}}>Username</label>
              <input
                className="modal-confirm-input"
                style={{width:'100%',boxSizing:'border-box'}}
                placeholder="Username"
                autoComplete="username"
                value={loginForm.username}
                onChange={e=>setLoginForm(p=>({...p,username:e.target.value}))}
              />
            </div>
            <div>
              <label style={{fontSize:'.82rem',fontWeight:600,color:'var(--txt-2)',display:'block',marginBottom:4}}>Password</label>
              <input
                className="modal-confirm-input"
                style={{width:'100%',boxSizing:'border-box'}}
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))}
              />
            </div>
            {loginError && <p style={{margin:0,fontSize:'.84rem',color:'var(--danger)'}}>{loginError}</p>}
            <button type="submit" className="modal-danger" style={{background:'var(--primary)',borderColor:'var(--primary)'}}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Authenticated view ── */
  const visible = hospitals.filter(h => !deleted.has(h.id));
  const totalBeds = visible.reduce((s,h)=>s+(h.total_icu_beds||0),0);

  if (loading) return <div className="center-state"><Loader2 size={28} className="spin-icon" strokeWidth={1.5}/></div>;

  return (
    <div className="content-wrap">
      <div className="content-header">
        <div>
          <h2 className="content-title" style={{display:'flex',alignItems:'center',gap:10}}>
            <ShieldCheck size={26} color="var(--primary)"/> Admin Panel
          </h2>
          <p className="content-sub">Manage all registered hospitals in the MediCore network</p>
        </div>
        <button className="modal-cancel" style={{alignSelf:'center'}} onClick={()=>setAdminAuthed(false)}>
          <LogOut size={14}/> Sign Out
        </button>
      </div>

      {/* Summary row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
        {[
          { Icon:Building2, val:visible.length, lbl:'Total Hospitals', color:'var(--primary)' },
          { Icon:BedDouble,  val:totalBeds,      lbl:'Total ICU Beds',  color:'var(--success)' },
        ].map(({Icon,val,lbl,color})=>(
          <div key={lbl} className="sc">
            <span className="sc-icon" style={{background:'var(--primary-light)',color}}><Icon size={22}/></span>
            <div><div className="sc-val" style={{color}}>{val}</div><div className="sc-lbl">{lbl}</div></div>
          </div>
        ))}
      </div>

      <div className="panel" style={{padding:0,overflow:'hidden'}}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Hospital Name</th><th>Location</th><th>ICU Beds</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {visible.map(h=>(
                <tr key={h.id}>
                  <td className="admin-hosp-name">{h.hospital_name}</td>
                  <td style={{fontSize:'.85rem',color:'var(--txt-2)'}}>{h.hospital_address||'—'}</td>
                  <td>
                    <span style={{fontWeight:700}}>{h.available_icu_beds}</span>
                    <span style={{color:'var(--txt-3)',fontSize:'.82rem'}}> / {h.total_icu_beds}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="admin-btn admin-btn-delete" onClick={()=>{setDeleteModal(h);setDeleteInput('');}}>
                        <Trash2 size={13}/> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length===0 && (
                <tr><td colSpan={4} style={{textAlign:'center',padding:'40px',color:'var(--txt-3)'}}>No hospitals found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={()=>setDeleteModal(null)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <Trash2 size={22} color="var(--danger)"/>
              <h2 className="modal-title" style={{margin:0,color:'var(--danger)'}}>Delete Hospital</h2>
            </div>
            <p className="modal-sub">
              You are about to permanently delete <strong>{deleteModal.hospital_name}</strong>.
              This action is irreversible. To confirm, type <code style={{background:'var(--bg-secondary)',padding:'2px 6px',borderRadius:4}}>DELETE</code> below.
            </p>
            <input
              className="modal-confirm-input"
              placeholder='Type DELETE to confirm'
              value={deleteInput}
              onChange={e=>setDeleteInput(e.target.value)}
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={()=>{setDeleteModal(null);setDeleteInput('');}}>Cancel</button>
              <button className="modal-danger" onClick={confirmDelete} disabled={deleteInput.trim()!=='DELETE'}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Auth View ──────────────────────────────────────────────────── */
function AuthView({ onAuthenticated }) {
  const [mode,   setMode]   = useState('login');
  const [form,   setForm]   = useState({ hospital_name:'', hospital_email:'', password:'', contact_number:'', latitude:'', longitude:'', hospital_address:'', specialties:'', total_icu_beds:'' });
  const [error,  setError]  = useState('');
  const [loading,setLoading]= useState(false);
  const [locating,setLocating]= useState(false);

  const set    = (k,v) => setForm(p=>({...p,[k]:v}));
  const switch2 = m  => { setMode(m); setError(''); };

  const detectLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { set('latitude',String(pos.coords.latitude)); set('longitude',String(pos.coords.longitude)); setLocating(false); },
      ()  => setLocating(false),
    );
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      let auth;
      if (mode==='signup') {
        auth = await hospitalSignup({
          hospital_name:   form.hospital_name,
          hospital_email:  form.hospital_email,
          password:        form.password,
          contact_number:  form.contact_number,
          latitude:        Number(form.latitude),
          longitude:       Number(form.longitude),
          hospital_address:form.hospital_address,
          specialties:     form.specialties.split(',').map(x=>x.trim()).filter(Boolean),
          total_icu_beds:  Number(form.total_icu_beds),
        });
      } else {
        auth = await hospitalLogin({ hospital_name:form.hospital_name, password:form.password });
      }
      localStorage.setItem('hospital_token', auth.access_token);
      onAuthenticated();
    } catch (err) { setError(err.message||'Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3v18M3 12h18"/>
            </svg>
          </div>
        </div>
        <h1 className="auth-heading">Hospital Portal</h1>
        <p className="auth-sub">{mode==='login' ? 'Sign in to manage your ICU dashboard' : 'Register your hospital on MediCore'}</p>

        <div className="auth-tabs">
          <button className={`atab ${mode==='login'?'atab-on':''}`} onClick={()=>switch2('login')}>Login</button>
          <button className={`atab ${mode==='signup'?'atab-on':''}`} onClick={()=>switch2('signup')}>Sign Up</button>
        </div>

        {error && <div className="auth-err"><AlertTriangle size={15}/>{error}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="fld">
            <label className="fld-lbl">Hospital Name</label>
            <input className="fld-inp" placeholder="e.g. Apollo Hospitals" value={form.hospital_name} onChange={e=>set('hospital_name',e.target.value)} required/>
          </div>

          {mode==='signup' && (
            <>
              <div className="frow2">
                <div className="fld">
                  <label className="fld-lbl">Email</label>
                  <input className="fld-inp" type="email" placeholder="admin@hospital.com" value={form.hospital_email} onChange={e=>set('hospital_email',e.target.value)} required/>
                </div>
                <div className="fld">
                  <label className="fld-lbl">Contact Number</label>
                  <input className="fld-inp" placeholder="+91 9876543210" value={form.contact_number} onChange={e=>set('contact_number',e.target.value)} required/>
                </div>
              </div>
              <div className="fld">
                <label className="fld-lbl">Hospital Address</label>
                <input className="fld-inp" placeholder="Full address" value={form.hospital_address} onChange={e=>set('hospital_address',e.target.value)} required/>
              </div>
              <div className="fld">
                <label className="fld-lbl">Specialties <span className="fld-hint">— comma-separated</span></label>
                <input className="fld-inp" placeholder="Cardiology, Neurology, Trauma" value={form.specialties} onChange={e=>set('specialties',e.target.value)} required/>
              </div>
              <div className="frow2">
                <div className="fld">
                  <label className="fld-lbl">Total ICU Beds</label>
                  <input className="fld-inp" type="number" placeholder="50" value={form.total_icu_beds} onChange={e=>set('total_icu_beds',e.target.value)} required/>
                </div>
                <div className="fld">
                  <label className="fld-lbl">Location</label>
                  <div className="loc-row">
                    <input className="fld-inp" type="number" step="any" placeholder="Latitude"  value={form.latitude}  onChange={e=>set('latitude',e.target.value)} required/>
                    <input className="fld-inp" type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={e=>set('longitude',e.target.value)} required/>
                    <button type="button" className="gps-btn" onClick={detectLocation} disabled={locating} title="Use GPS">
                      {locating ? <Loader2 size={16} className="spin-icon"/> : <Navigation size={16}/>}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="fld">
            <label className="fld-lbl">Password</label>
            <input className="fld-inp" type="password" placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)} required/>
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin-icon"/> : (mode==='signup' ? 'Create Account' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Root App ───────────────────────────────────────────────────── */
export default function App() {
  const { hash, navigate, match } = useRouter();
  const { push: pushToast, ToastContainer } = useToast();

  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('hospital_token')));
  const [hospitalName,  setHospitalName]  = useState('');

  const logout = () => {
    localStorage.removeItem('hospital_token');
    setAuthenticated(false); setHospitalName('');
    navigate('/');
  };

  const handleAuthenticated = async () => {
    setAuthenticated(true);
    navigate('/dashboard');
    try { const me = await getHospitalMe(); setHospitalName(me.hospital_name); }
    catch { /* non-critical */ }
  };

  // Resolve current page
  const hospitalDetailParams  = match('hospital/:id');
  const bookParams            = match('book/:id');
  const isAuth                = hash === '/auth';
  const isDashboard           = hash === '/dashboard' || hash === '/blood' || hash === '/oxygen' || hash === '/receptionist';
  const isAdmin               = hash === '/admin';
  const isReceptionist         = hash === '/receptionist';

  const renderPage = () => {
    if (hospitalDetailParams)   return <HospitalDetail hospitalId={hospitalDetailParams.id} navigate={navigate}/>;
    if (bookParams)             return <BookAppointment hospitalId={bookParams.id} navigate={navigate}/>;
    if (isAuth)                 return authenticated
      ? (() => { navigate('/dashboard'); return null; })()
      : <AuthView onAuthenticated={handleAuthenticated}/>;
    if (hash==='/blood')        return authenticated ? <BloodBankPage navigate={navigate}/> : <AuthView onAuthenticated={handleAuthenticated}/>;
    if (hash==='/oxygen')       return authenticated ? <OxygenPage navigate={navigate}/> : <AuthView onAuthenticated={handleAuthenticated}/>;
    if (isReceptionist)         return <ReceptionistDashboard navigate={navigate}/>;
    if (isAdmin)                return <AdminDashboard navigate={navigate}/>;
    if (hash==='/dashboard')    return authenticated
      ? <HospitalDashboard onUnauthorized={logout} navigate={navigate} hash={hash}/>
      : <AuthView onAuthenticated={handleAuthenticated}/>;
    // Default: public hospital list
    return <PublicHospitalList navigate={navigate}/>;
  };

  return (
    <div className="app">
      <Navbar
        authenticated={authenticated}
        hospitalName={hospitalName}
        navigate={navigate}
        hash={hash}
        onLogout={authenticated ? logout : null}
      />
      <main className="app-main">
        {renderPage()}
      </main>
      <ToastContainer/>
    </div>
  );
}
