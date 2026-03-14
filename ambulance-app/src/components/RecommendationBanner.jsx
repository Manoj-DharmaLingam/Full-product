import React from 'react';
import { Navigation, Bed, Clock, Star } from 'lucide-react';

const TRAFFIC_LABEL = {
  LOW:    { text: 'Low traffic',  dot: '#10b981' },
  MEDIUM: { text: 'Med traffic',  dot: '#f59e0b' },
  HIGH:   { text: 'High traffic', dot: '#ef4444' },
};

export default function RecommendationBanner({ hospital }) {
  if (!hospital) return null;

  const traffic = hospital.traffic_level ? TRAFFIC_LABEL[hospital.traffic_level] : null;

  return (
    <div className="rec-banner">
      <div className="rec-banner__icon">
        <Navigation size={20} />
      </div>
      <div className="rec-banner__info">
        <div className="rec-banner__label">
          <Star size={10} style={{ marginRight: 4 }} />
          Best Match Hospital
        </div>
        <div className="rec-banner__name">{hospital.hospital_name}</div>
        <div className="rec-banner__meta">
          <Clock size={11} />
          {Math.round(hospital.eta_minutes)} min
          <span className="meta-sep">·</span>
          <Bed size={11} />
          {hospital.available_icu_beds} ICU bed{hospital.available_icu_beds !== 1 ? 's' : ''}
          <span className="meta-sep">·</span>
          {hospital.distance_km} km
          {traffic && (
            <>
              <span className="meta-sep">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: traffic.dot, display: 'inline-block',
                }} />
                {traffic.text}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
