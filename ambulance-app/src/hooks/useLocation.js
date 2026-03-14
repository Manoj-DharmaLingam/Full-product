import { useState, useEffect, useCallback } from 'react';

/**
 * useLocation — browser geolocation hook
 * Returns { lat, lng, error, loading, refetch }
 */
export function useLocation() {
  const [state, setState] = useState({
    lat: null,
    lng: null,
    error: null,
    loading: true,
  });

  const fetchLocation = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setState({ lat: null, lng: null, error: 'Geolocation is not supported by this browser.', loading: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        let message;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location access denied. Please allow location permissions.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out. Retrying…';
            // Retry once with lower accuracy
            navigator.geolocation.getCurrentPosition(
              (pos) => setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, error: null, loading: false }),
              () => setState({ lat: null, lng: null, error: 'Unable to determine location.', loading: false }),
              { enableHighAccuracy: false, timeout: 10000 }
            );
            return;
          default:
            message = 'An unknown location error occurred.';
        }
        setState({ lat: null, lng: null, error: message, loading: false });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return { ...state, refetch: fetchLocation };
}
