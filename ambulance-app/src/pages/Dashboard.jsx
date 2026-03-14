import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from '../hooks/useLocation';
import { postAmbulanceRequest, postAlert, bookIcu, getAmbulanceMe, updateAmbulanceLocation } from '../services/api';
import PatientForm from '../components/PatientForm';
import HospitalList from '../components/HospitalList';
import RecommendationBanner from '../components/RecommendationBanner';
import MapView from '../components/MapView';
import {
  Ambulance, MapPin, RefreshCw, WifiOff,
  CheckCircle2, AlertCircle, Info, HeartPulse,
} from 'lucide-react';

/* ─── Toast ────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <CheckCircle2 size={15}/>}
          {t.type === 'error'   && <AlertCircle  size={15}/>}
          {t.type === 'info'    && <Info          size={15}/>}
          {t.message}
        </div>
      ))}
    </div>
  );
}

let toastId = 0;

export default function Dashboard({ onLogout }) {
  const { lat, lng, error: locError, loading: locLoading, refetch } = useLocation();
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const [patientData,       setPatientData]       = useState(null);
  const [formLoading,       setFormLoading]       = useState(false);
  const [showHospitals,     setShowHospitals]     = useState(false);
  const [selectedHospital,  setSelectedHospital]  = useState(null);
  const [topHospital,       setTopHospital]       = useState(null);
  const [toasts,            setToasts]            = useState([]);
  const [alertSent,         setAlertSent]         = useState(false);
  const [ambulanceReqId,    setAmbulanceReqId]    = useState(null);
  const [submissionError,   setSubmissionError]   = useState('');

  // GPS → manual fallback
  const effectiveLat  = lat !== null ? lat : (manualLat !== '' ? Number(manualLat) : null);
  const effectiveLng  = lng !== null ? lng : (manualLng !== '' ? Number(manualLng) : null);
  const locationReady = !!effectiveLat && !!effectiveLng && !isNaN(effectiveLat) && !isNaN(effectiveLng);
  const usingManual   = lat === null && locationReady;

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  // Load saved ambulance location on mount
  useEffect(() => {
    getAmbulanceMe().then(profile => {
      if (profile.latitude  != null) setManualLat(String(profile.latitude));
      if (profile.longitude != null) setManualLng(String(profile.longitude));
    }).catch(() => {});
  }, []);

  // Persist GPS fix to DB for next session
  useEffect(() => {
    if (lat !== null && lng !== null) {
      updateAmbulanceLocation(lat, lng).catch(() => {});
    }
  }, [lat, lng]);

  const handleFormSubmit = async (formData) => {
    setFormLoading(true);
    setPatientData(formData);
    setSelectedHospital(null);
    setTopHospital(null);
    setAlertSent(false);
    setAmbulanceReqId(null);
    setSubmissionError('');
    try {
      const res = await postAmbulanceRequest({ latitude: effectiveLat, longitude: effectiveLng, ...formData });
      if (res?.id) setAmbulanceReqId(res.id);
      showToast('Request registered — finding nearest hospitals…', 'info');
      setShowHospitals(true);
    } catch (err) {
      setSubmissionError(err.message || 'Unable to register the ambulance request.');
      showToast(err.message || 'Unable to register the ambulance request.', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSelectHospital = async (hospital) => {
    if (!ambulanceReqId) {
      showToast('Create an ambulance request before sending a hospital alert.', 'error');
      return;
    }
    if (alertSent && selectedHospital?.hospital_id === hospital.hospital_id) return;
    setSelectedHospital(hospital);
    try {
      await postAlert({
        hospital_id:          hospital.hospital_id,
        ambulance_request_id: ambulanceReqId,
        eta:                  hospital.eta_minutes || 0,
      });
      const isCritical = patientData?.severity_level?.toLowerCase() === 'critical';
      if (isCritical && ambulanceReqId) {
        try {
          await bookIcu(hospital.hospital_id, ambulanceReqId);
          showToast(`ICU auto-booked at ${hospital.hospital_name} for critical patient`, 'success', 6000);
        } catch {
          showToast(`Alert sent to ${hospital.hospital_name} — ICU reservation active`, 'success', 5000);
        }
      } else {
        showToast(`Alert sent to ${hospital.hospital_name}`, 'success', 5000);
      }
      setAlertSent(true);
    } catch (err) {
      showToast(err.message || 'Unable to send the hospital alert.', 'error');
    }
  };

  return (
    <div className="dashboard">

      {/* Announcement bar */}
      <div className="announcement-bar">
        MediCore Emergency Routing &nbsp;·&nbsp; Real-Time ICU Bed Availability &nbsp;·&nbsp; Active 24/7
      </div>

      {/* Header */}
      <header className="header">
        <div className="header__brand">
          <div className="header__logo-icon">
            <Ambulance size={20} color="#fff"/>
          </div>
          <div>
            <div className="header__title">MediCore</div>
            <div className="header__subtitle">Ambulance · Emergency Routing</div>
          </div>
        </div>

        {/* GPS status pill */}
        <div className="header__status">
          {locLoading && (
            <><span className="spinner" style={{width:8,height:8,borderWidth:1.5}}/> Locating…</>
          )}
          {!locLoading && lat !== null && (
            <><span className="status-dot"/> GPS Active</>
          )}
          {!locLoading && locError && usingManual && (
            <><span className="status-dot" style={{background:'var(--warning)'}}/> Manual Location</>
          )}
          {!locLoading && locError && !usingManual && (
            <><span className="status-dot danger"/> Location Error</>
          )}
        </div>

        <button className="btn btn-ghost" onClick={onLogout}>Logout</button>
      </header>

      {/* Hero strip */}
      <div className="hero-strip">
        <div className="hero-strip__content">
          <span className="hero-strip__badge">Emergency Mode</span>
          <h1 className="hero-strip__heading">Find the Nearest ICU Hospital</h1>
          <p className="hero-strip__sub">Real-time ICU tracking — route to the closest available hospital instantly</p>
        </div>
      </div>

      {/* Body */}
      <main className="dashboard__body">

        {/* LEFT — location + form */}
        <section className="left-panel">

          {/* Location card */}
          <div className="card location-card">
            <div className="location-icon">
              <MapPin size={18}/>
            </div>
            <div className="location-info" style={{flex:1}}>
              <div className="location-label">Ambulance Location</div>
              {locLoading && (
                <div className="location-coords">
                  <span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> Detecting…
                </div>
              )}
              {!locLoading && lat !== null && (
                <div className="location-coords">{lat.toFixed(6)}°N, {lng.toFixed(6)}°E</div>
              )}
              {!locLoading && locError && (
                <>
                  <div className="location-error" style={{marginBottom:8}}>{locError}</div>
                  <div style={{display:'flex',gap:6}}>
                    <input
                      className="form-control" type="number" step="any" placeholder="Latitude"
                      value={manualLat} onChange={e => setManualLat(e.target.value)}
                      style={{fontSize:'.78rem',padding:'5px 8px'}}
                    />
                    <input
                      className="form-control" type="number" step="any" placeholder="Longitude"
                      value={manualLng} onChange={e => setManualLng(e.target.value)}
                      style={{fontSize:'.78rem',padding:'5px 8px'}}
                    />
                  </div>
                </>
              )}
            </div>
            {!locLoading && locError && (
              <button
                className="btn-ghost btn" style={{width:'auto',fontSize:'.75rem',alignSelf:'flex-start'}}
                onClick={refetch}
              >
                <RefreshCw size={12}/> Retry GPS
              </button>
            )}
          </div>

          {/* Offline notice */}
          {!locLoading && !locError && lat === null && (
            <div className="error-banner">
              <WifiOff size={14}/> Location unavailable — please allow location access.
            </div>
          )}

          {/* Patient form */}
          <div className="card">
            {submissionError && (
              <div className="error-banner" style={{margin:'1rem 1rem 0'}}>
                <AlertCircle size={14}/> {submissionError}
              </div>
            )}
            <PatientForm onSubmit={handleFormSubmit} loading={formLoading} locationReady={locationReady}/>
          </div>
        </section>

        {/* RIGHT — hospital results */}
        <section className="right-panel">
          {showHospitals ? (
            <>
              <RecommendationBanner hospital={topHospital}/>
              <div className="card" style={{padding:'1.3rem'}}>
                <HospitalList
                  lat={effectiveLat}
                  lng={effectiveLng}
                  severity={patientData?.severity_level || 'Serious'}
                  requiredSpecialty={patientData?.required_specialty || ''}
                  onSelect={handleSelectHospital}
                  selectedHospital={selectedHospital}
                  onHospitalsLoaded={sorted => setTopHospital(sorted[0] || null)}
                />
              </div>
            </>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state__icon">
                  <HeartPulse size={30} color="var(--text-muted)"/>
                </div>
                <span className="empty-state__title">Ready to Find Hospitals</span>
                <span className="empty-state__desc">
                  Fill in the patient details and press <strong>Find Best Hospital</strong> to get ranked hospitals by distance and ICU availability.
                </span>
                <div className="deco-line"/>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Map */}
      <section className="map-section">
        <div className="map-section__label">
          <MapPin size={13} color="var(--primary)"/>
          {(selectedHospital ?? topHospital)
            ? `Route to ${(selectedHospital ?? topHospital).hospital_name}`
            : 'Route to Hospital'}
        </div>
        <MapView
          ambulanceLat={effectiveLat}
          ambulanceLng={effectiveLng}
          hospitals={showHospitals
            ? [topHospital, selectedHospital]
                .filter(Boolean)
                .reduce((acc, h) => acc.some(x => x.hospital_id === h.hospital_id) ? acc : [...acc, h], [])
            : []}
          selectedHospital={selectedHospital ?? topHospital}
        />
      </section>

      <Toast toasts={toasts}/>
    </div>
  );
}
