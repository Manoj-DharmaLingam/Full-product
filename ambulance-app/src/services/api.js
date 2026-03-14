import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE_URL });

// Auto-logout when a protected call returns 401 (expired / invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('ambulance_token')) {
      localStorage.removeItem('ambulance_token');
      window.dispatchEvent(new Event('ambulance:unauthorized'));
    }
    return Promise.reject(error);
  }
);

function authHeaders() {
  const token = localStorage.getItem('ambulance_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractError(error) {
  if (error.response) {
    const payload = error.response.data;
    let message = `Request failed with ${error.response.status}`;

    if (typeof payload === 'string' && payload) {
      message = payload;
    } else if (payload && typeof payload === 'object') {
      message = payload.detail || payload.message || JSON.stringify(payload);
    }

    const wrapped = new Error(message);
    wrapped.status = error.response.status;
    return wrapped;
  }

  return new Error(error.message || 'Network request failed');
}

async function ajaxJson(path, options = {}) {
  try {
    const response = await api.request({ url: path, ...options });
    return response.data;
  } catch (error) {
    throw extractError(error);
  }
}

export async function ambulanceSignup(payload) {
  return ajaxJson('/auth/ambulance/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });
}

export async function ambulanceLogin(payload) {
  return ajaxJson('/auth/ambulance/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });
}

export async function postAmbulanceRequest(payload) {
  return ajaxJson('/ambulance/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: payload,
  });
}

export async function fetchRecommendedHospitals(lat, lng, severity, requiredSpecialty = '') {
  const params = {
    latitude: String(lat),
    longitude: String(lng),
    severity,
  };

  if (requiredSpecialty) {
    params.required_specialty = requiredSpecialty;
  }

  return ajaxJson('/ambulance/recommend-hospital', {
    headers: { ...authHeaders() },
    params,
  });
}

export async function postAlert(payload) {
  return ajaxJson('/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: payload,
  });
}

export async function bookIcu(hospitalId, ambulanceRequestId) {
  return ajaxJson('/ambulance/book-icu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: { hospital_id: hospitalId, ambulance_request_id: ambulanceRequestId },
  });
}

export async function getAmbulanceMe() {
  return ajaxJson('/ambulance/me', { headers: { ...authHeaders() } });
}

export async function updateAmbulanceLocation(latitude, longitude) {
  return ajaxJson('/ambulance/update-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: { latitude, longitude },
  });
}
