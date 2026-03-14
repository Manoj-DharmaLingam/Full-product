import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE_URL });

function authHeaders() {
  const token = localStorage.getItem('hospital_token');
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

export async function hospitalSignup(payload) {
  return ajaxJson('/auth/hospital/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });
}

export async function hospitalLogin(payload) {
  return ajaxJson('/auth/hospital/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });
}

export async function getHospitalMe() {
  return ajaxJson('/hospital/me', { headers: { ...authHeaders() } });
}

export async function updateHospitalIcu(mode, count = 1) {
  return ajaxJson('/hospital/update-icu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: { mode, count },
  });
}

export async function getHospitalAlerts() {
  return ajaxJson('/hospital/alerts', { headers: { ...authHeaders() } });
}

export async function getPublicHospitals() {
  return ajaxJson('/public/hospitals');
}

export async function updateHospitalLocation(latitude, longitude) {
  return ajaxJson('/hospital/update-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: { latitude, longitude },
  });
}

export async function updateAlertStatus(alertId, status) {
  return ajaxJson(`/alerts/${alertId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data: { status },
  });
}

export async function getMyDoctors() {
  return ajaxJson('/hospital/doctors', { headers: { ...authHeaders() } });
}

export async function createDoctor(data) {
  return ajaxJson('/hospital/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data,
  });
}

export async function updateDoctor(id, data) {
  return ajaxJson(`/hospital/doctors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    data,
  });
}

export async function deleteDoctor(id) {
  return ajaxJson(`/hospital/doctors/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
}

export async function getPublicDoctors(hospitalId) {
  return ajaxJson(`/public/hospitals/${hospitalId}/doctors`);
}
