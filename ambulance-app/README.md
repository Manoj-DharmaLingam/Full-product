# Ambulance Operations App

Ambulance-side React application for creating live emergency requests, viewing ranked ICU hospitals, navigating to a selected destination, and sending hospital alerts.

## Features

- Authenticated ambulance login and signup
- Browser GPS with manual coordinate fallback
- Live patient intake with severity, oxygen level, blood group, and specialty fields
- Ranked hospital recommendations from the backend
- Google Maps route visualization to the selected hospital
- ICU reservation and pre-arrival alert workflows

## Setup

1. Install dependencies with `npm install`
2. Create `.env` from `.env.example`
3. Configure:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

4. Start the app with `npm run dev`

The backend API must be running. This app no longer falls back to mock or demo data.

## Required Backend Endpoints

- `POST /auth/ambulance/signup`
- `POST /auth/ambulance/login`
- `GET /ambulance/me`
- `POST /ambulance/update-location`
- `POST /ambulance/request`
- `GET /ambulance/recommend-hospital`
- `POST /alerts`
- `POST /ambulance/book-icu`

## Production Build

- `npm run build`
- `npm run lint`
