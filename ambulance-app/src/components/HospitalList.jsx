import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRecommendedHospitals } from '../services/api';
import HospitalCard from './HospitalCard';
import { RefreshCw, Building2 } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="card skeleton-card" style={{ padding: '1.1rem 1.25rem' }}>
      <div className="skeleton skeleton-line" style={{ height: 20, width: '65%', marginBottom: 14 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div className="skeleton skeleton-line" style={{ height: 14 }} />
        <div className="skeleton skeleton-line" style={{ height: 14 }} />
        <div className="skeleton skeleton-line" style={{ height: 14 }} />
        <div className="skeleton skeleton-line" style={{ height: 14 }} />
      </div>
      <div className="skeleton skeleton-line" style={{ height: 5, marginBottom: 12 }} />
      <div className="skeleton skeleton-line" style={{ height: 40, borderRadius: 999 }} />
    </div>
  );
}

const POLL_MS = 30000; // 30 s — Distance Matrix calls are rate-limited, so poll less aggressively
const DM_BATCH_SIZE = 25; // Distance Matrix JS API max destinations per request

// Wait until window.google.maps is available (Maps script is loaded by MapView)
function waitForGoogleMaps(timeoutMs = 8000) {
  if (window.google?.maps) return Promise.resolve(true);
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (window.google?.maps) { resolve(true); return; }
      if (Date.now() - start > timeoutMs) { resolve(false); return; }
      setTimeout(check, 250);
    };
    check();
  });
}

// Classify traffic level from extra delay in seconds
function trafficLevel(durationSec, trafficSec) {
  const extraMin = (trafficSec - durationSec) / 60;
  if (extraMin <= 2) return 'LOW';
  if (extraMin <= 6) return 'MEDIUM';
  return 'HIGH';
}

// Haversine fallback (straight-line km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Call Distance Matrix API in batches of DM_BATCH_SIZE, return enriched hospital list
async function enrichWithTraffic(hospitals, lat, lng) {
  const mapsReady = await waitForGoogleMaps();
  if (!mapsReady || !hospitals.length) {
    // Maps not available — tag all as UNKNOWN so the UI shows "Est. distance"
    return hospitals.map((h) => ({ ...h, traffic_level: h.traffic_level ?? 'UNKNOWN' }));
  }

  const service = new window.google.maps.DistanceMatrixService();
  const origin = { lat, lng };

  // Split into batches
  const batches = [];
  for (let i = 0; i < hospitals.length; i += DM_BATCH_SIZE) {
    batches.push(hospitals.slice(i, i + DM_BATCH_SIZE));
  }

  const enriched = [...hospitals];

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    const globalOffset = bIdx * DM_BATCH_SIZE;

    const elements = await new Promise((resolve) => {
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: batch.map((h) => ({ lat: h.latitude, lng: h.longitude })),
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: window.google.maps.TrafficModel?.BEST_GUESS ?? 'bestGuess',
          },
        },
        (response, status) => {
          if (status === 'OK' && response?.rows?.[0]?.elements) {
            resolve(response.rows[0].elements);
          } else {
            resolve(null); // fall back to Haversine for this batch
          }
        }
      );
    });

    batch.forEach((hospital, i) => {
      const el = elements?.[i];
      const globalIdx = globalOffset + i;

      if (el?.status === 'OK') {
        const distKm = parseFloat((el.distance.value / 1000).toFixed(2));
        const durSec = el.duration.value;
        const trafficSec = el.duration_in_traffic?.value ?? durSec;
        enriched[globalIdx] = {
          ...hospital,
          distance_km: distKm,
          eta_minutes: parseFloat((trafficSec / 60).toFixed(1)),
          traffic_level: trafficLevel(durSec, trafficSec),
          _traffic_sec: trafficSec,
        };
      } else {
        // Haversine fallback for this hospital
        const distKm = parseFloat(haversineKm(lat, lng, hospital.latitude, hospital.longitude).toFixed(2));
        enriched[globalIdx] = {
          ...hospital,
          distance_km: distKm,
          eta_minutes: parseFloat(((distKm / 45) * 60).toFixed(1)),
          traffic_level: 'UNKNOWN',
          _traffic_sec: (distKm / 45) * 3600,
        };
      }
    });
  }

  // Re-sort: 1) ICU availability, 2) specialty match, 3) traffic-aware ETA
  enriched.sort((a, b) => {
    if (a.available_icu_beds === 0 && b.available_icu_beds > 0) return 1;
    if (b.available_icu_beds === 0 && a.available_icu_beds > 0) return -1;
    if (a.specialty_match !== b.specialty_match) return b.specialty_match - a.specialty_match;
    return (a._traffic_sec ?? a.eta_minutes * 60) - (b._traffic_sec ?? b.eta_minutes * 60);
  });

  // Clean up internal sort key
  enriched.forEach((h) => delete h._traffic_sec);
  return enriched;
}

export default function HospitalList({ lat, lng, severity, requiredSpecialty, onSelect, selectedHospital, onHospitalsLoaded }) {
  const [hospitals, setHospitals]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [error, setError]                   = useState('');
  const [lastRefresh, setLastRefresh]       = useState(null);
  const [usingFallback, setUsingFallback]   = useState(false);

  const onHospitalsLoadedRef = useRef(onHospitalsLoaded);
  useEffect(() => { onHospitalsLoadedRef.current = onHospitalsLoaded; }, [onHospitalsLoaded]);

  const load = useCallback(async (silent = false) => {
    if (!lat || !lng) return;
    if (!silent) setLoading(true);
    setError('');

    try {
      // 1. Fetch Haversine-ranked candidates from backend
      const raw = await fetchRecommendedHospitals(lat, lng, severity, requiredSpecialty);

      // 2. Show backend results immediately (loading state resolved)
      if (!silent) setLoading(false);
      setHospitals(raw);
      if (onHospitalsLoadedRef.current) onHospitalsLoadedRef.current(raw);

      // 3. Enrich with real traffic data from Distance Matrix API
      if (!silent) setTrafficLoading(true);
      setUsingFallback(false);
      const trafficEnriched = await enrichWithTraffic(raw, lat, lng);
      const hasFallback = trafficEnriched.some((h) => !h.traffic_level || h.traffic_level === 'UNKNOWN');
      setUsingFallback(hasFallback);
      setHospitals(trafficEnriched);
      setLastRefresh(new Date());
      if (onHospitalsLoadedRef.current) onHospitalsLoadedRef.current(trafficEnriched);
    } catch (err) {
      if (!silent) {
        setHospitals([]);
        setError(err.message || 'Unable to load hospital recommendations.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setTrafficLoading(false);
      } else {
        setTrafficLoading(false);
      }
    }
  }, [lat, lng, severity, requiredSpecialty]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const refreshLabel = lastRefresh
    ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Loading…';

  return (
    <div>
      <div className="hospital-list__header">
        <span className="hospital-list__title">
          <Building2 size={16} color="var(--purple-accent)" />
          Nearby Hospitals
          {trafficLoading && (
            <span className="traffic-calculating-pill">
              <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
              Live traffic…
            </span>
          )}
          {!trafficLoading && usingFallback && (
            <span className="traffic-fallback-pill">Est. distance</span>
          )}
          {!trafficLoading && !usingFallback && lastRefresh && (
            <span className="traffic-ok-pill">Live traffic</span>
          )}
        </span>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => load(false)}
          style={{ width: 'auto', fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
        >
          <RefreshCw size={12} /> {refreshLabel}
        </button>
      </div>

      <div className="hospital-list__scroll">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Building2 size={26} color="var(--text-muted)" /></div>
            <span className="empty-state__title">Recommendations unavailable</span>
            <span className="empty-state__desc">{error}</span>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Building2 size={26} color="var(--text-muted)" /></div>
            <span className="empty-state__title">No hospitals found</span>
            <span className="empty-state__desc">No hospitals with available ICU beds were found near your location.</span>
          </div>
        ) : (
          hospitals.map((h, idx) => (
            <HospitalCard
              key={h.hospital_id}
              hospital={h}
              isRecommended={idx === 0}
              isSelected={selectedHospital?.hospital_id === h.hospital_id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
