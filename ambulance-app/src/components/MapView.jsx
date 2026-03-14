import React, { useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// SVG marker creation
function makeAmbulanceMarker(maps) {
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
    fillColor: '#0b57d0',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
    scale: 1.6,
    anchor: new maps.Point(12, 22),
  };
}

function makeHospitalMarker(maps, trafficLevel) {
  // Red for high traffic, orange for medium, green for low, default red
  const colors = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea4335', UNKNOWN: '#ea4335' };
  const fillColor = (trafficLevel && colors[trafficLevel]) ? colors[trafficLevel] : '#ea4335';
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
    fillColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: new maps.Point(12, 22),
  };
}

const TRAFFIC_DOT = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

export default function MapView({ ambulanceLat, ambulanceLng, hospitals, selectedHospital }) {
  const mapRef          = useRef(null);
  const googleMapRef    = useRef(null);
  const markersRef      = useRef([]);
  const routeRendererRef = useRef(null);
  const trafficLayerRef = useRef(null);

  const isMapsConfigured = Boolean(MAPS_API_KEY);
  const configError = isMapsConfigured
    ? null
    : 'Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.';
  const [mapError, setMapError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(() => Boolean(window.google && window.google.maps));

  // Load Google Maps script once (includes directions + Traffic layer)
  useEffect(() => {
    if (!isMapsConfigured) return;
    if (window.google && window.google.maps) { setMapLoaded(true); return; }

    const existing = document.getElementById('gmaps-script');
    if (existing) { existing.onload = () => setMapLoaded(true); return; }

    const script = document.createElement('script');
    script.id = 'gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=directions`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError('Failed to load Google Maps. Check your API key and network.');
    document.head.appendChild(script);
  }, [isMapsConfigured]);

  // Initialise or update map center
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const maps = window.google.maps;
    const hasLocation = ambulanceLat && ambulanceLng;
    const center = hasLocation ? { lat: ambulanceLat, lng: ambulanceLng } : { lat: 20.0, lng: 0.0 };
    const zoom = hasLocation ? 13 : 2;

    if (!googleMapRef.current) {
      googleMapRef.current = new maps.Map(mapRef.current, {
        center,
        zoom,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      // Real-time traffic overlay layer
      trafficLayerRef.current = new maps.TrafficLayer();
      trafficLayerRef.current.setMap(googleMapRef.current);
    } else if (hasLocation) {
      googleMapRef.current.setCenter(center);
    }
  }, [mapLoaded, ambulanceLat, ambulanceLng]);

  // Update markers
  useEffect(() => {
    if (!mapLoaded || !googleMapRef.current) return;
    const maps = window.google.maps;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Ambulance marker
    if (ambulanceLat && ambulanceLng) {
      const amb = new maps.Marker({
        position: { lat: ambulanceLat, lng: ambulanceLng },
        map: googleMapRef.current,
        title: 'Your Ambulance',
        icon: makeAmbulanceMarker(maps),
        zIndex: 10,
      });
      markersRef.current.push(amb);
    }

    // Hospital markers — colour-coded by traffic level
    (hospitals || []).forEach((h, i) => {
      const marker = new maps.Marker({
        position: { lat: h.latitude, lng: h.longitude },
        map: googleMapRef.current,
        title: h.hospital_name,
        icon: makeHospitalMarker(maps, h.traffic_level),
        zIndex: i === 0 ? 9 : 8,
      });

      const dot = h.traffic_level && TRAFFIC_DOT[h.traffic_level]
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${TRAFFIC_DOT[h.traffic_level]};margin-right:4px;"></span>`
        : '';
      const trafficText = h.traffic_level && h.traffic_level !== 'UNKNOWN'
        ? `${dot}${h.traffic_level.charAt(0) + h.traffic_level.slice(1).toLowerCase()} traffic`
        : '';

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="padding:10px 12px;font-family:'Google Sans',Roboto,Arial,sans-serif;min-width:190px;">
            <strong style="color:#1f1f1f;font-size:0.9rem;">${h.hospital_name}</strong><br/>
            <span style="font-size:0.78rem;color:#636363;">🕐 ${Math.round(h.eta_minutes)} min &nbsp;·&nbsp; 📍 ${h.distance_km} km</span><br/>
            <span style="font-size:0.78rem;color:#636363;">🛏 ${h.available_icu_beds} ICU beds</span><br/>
            ${trafficText ? `<span style="font-size:0.75rem;color:#636363;display:flex;align-items:center;margin-top:2px;">${trafficText}</span>` : ''}
          </div>
        `,
      });
      marker.addListener('click', () => infoWindow.open(googleMapRef.current, marker));
      markersRef.current.push(marker);
    });
  }, [mapLoaded, ambulanceLat, ambulanceLng, hospitals]);

  // Draw traffic-aware route to selected hospital
  useEffect(() => {
    if (!mapLoaded || !googleMapRef.current) return;
    const maps = window.google.maps;

    if (!selectedHospital || !ambulanceLat || !ambulanceLng) {
      if (routeRendererRef.current) {
        routeRendererRef.current.setMap(null);
        routeRendererRef.current = null;
      }
      return;
    }

    if (!routeRendererRef.current) {
      routeRendererRef.current = new maps.DirectionsRenderer({
        polylineOptions: { strokeColor: '#0b57d0', strokeWeight: 4, strokeOpacity: 0.85 },
        suppressMarkers: true,
      });
      routeRendererRef.current.setMap(googleMapRef.current);
    }

    const service = new maps.DirectionsService();
    service.route(
      {
        origin: { lat: ambulanceLat, lng: ambulanceLng },
        destination: { lat: selectedHospital.latitude, lng: selectedHospital.longitude },
        travelMode: maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: maps.TrafficModel?.BEST_GUESS ?? 'bestGuess',
        },
      },
      (result, status) => {
        if (status === 'OK') routeRendererRef.current.setDirections(result);
      }
    );
  }, [mapLoaded, selectedHospital, ambulanceLat, ambulanceLng]);

  return (
    <div className="map-container" id="map-view">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {(configError || mapError) && (
        <div className="map-overlay">
          <AlertCircle size={32} color="var(--danger)" />
          <span style={{ maxWidth: 340, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-mid)' }}>
            {configError || mapError}
          </span>
        </div>
      )}
      {!mapLoaded && !configError && !mapError && (
        <div className="map-overlay">
          <MapPin size={28} color="var(--purple-accent)" />
          <span className="spinner" />
          <span style={{ color: 'var(--text-mid)' }}>Loading map…</span>
        </div>
      )}
    </div>
  );
}
