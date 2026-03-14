import React from 'react';
import { Clock, Bed, MapPin, CheckCircle, XCircle, Navigation, TrendingUp } from 'lucide-react';

function icuClass(beds) {
  if (beds === 0) return 'icu-none';
  if (beds <= 2)  return 'icu-low';
  return 'icu-ok';
}

function TrafficBadge({ level }) {
  if (!level || level === 'UNKNOWN') return null;
  const map = {
    LOW:    { label: 'Low traffic',    cls: 'traffic-low' },
    MEDIUM: { label: 'Med traffic',    cls: 'traffic-medium' },
    HIGH:   { label: 'High traffic',   cls: 'traffic-high' },
  };
  const { label, cls } = map[level] ?? map.LOW;
  return <span className={`traffic-badge ${cls}`}>{label}</span>;
}

export default function HospitalCard({ hospital, isRecommended, isSelected, onSelect }) {
  const {
    hospital_name, distance_km, eta_minutes,
    available_icu_beds, specialty_match, score = 0,
    traffic_level,
  } = hospital;
  const scorePercent = Math.round(score * 100);

  const cardClass = [
    'hospital-card',
    isRecommended ? 'recommended' : '',
    isSelected    ? 'selected'    : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      onClick={() => onSelect(hospital)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(hospital)}
      id={`hospital-card-${hospital.hospital_id}`}
    >
      {/* Header */}
      <div className="hospital-card__header">
        <span className="hospital-card__name">{hospital_name}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {isRecommended
            ? <span className="badge badge-recommended">Best Match</span>
            : <span className="badge badge-fallback">Option</span>}
          <TrafficBadge level={traffic_level} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="hospital-card__stats">
        <div className="stat-item">
          <span className="stat-label"><MapPin size={10}/> Distance</span>
          <span className="stat-value highlight">{distance_km} km</span>
        </div>
        <div className="stat-item">
          <span className="stat-label"><Clock size={10}/> ETA</span>
          <span className="stat-value highlight">{Math.round(eta_minutes)} min</span>
        </div>
        <div className="stat-item">
          <span className="stat-label"><Bed size={10}/> ICU Beds</span>
          <span className={`stat-value ${icuClass(available_icu_beds)}`}>
            {available_icu_beds === 0 ? 'None' : `${available_icu_beds} free`}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Specialty</span>
          <span className={`specialty-match ${specialty_match ? 'matched' : 'unmatched'}`}>
            {specialty_match
              ? <><CheckCircle size={12}/> Matched</>
              : <><XCircle    size={12}/> No match</>}
          </span>
        </div>
      </div>

      {/* Confidence score bar */}
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${scorePercent}%` }}/>
      </div>

      {/* Action button */}
      <button
        className={isSelected ? 'btn btn-outline' : 'btn btn-primary'}
        style={{ fontSize: '.82rem', padding: '10px 16px' }}
        onClick={e => { e.stopPropagation(); onSelect(hospital); }}
        id={`select-hospital-${hospital.hospital_id}`}
      >
        {isSelected
          ? <><CheckCircle size={15}/> Hospital Selected</>
          : <><Navigation  size={15}/> Select This Hospital</>}
      </button>
    </div>
  );
}
