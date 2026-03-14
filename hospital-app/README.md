# Hospital Operations App

Hospital-side React application for publishing ICU capacity, maintaining hospital coordinates, and responding to incoming ambulance alerts.

## Features

- Public ICU availability board
- Hospital signup and secure login
- ICU bed inventory management
- Live ambulance alert feed
- Coordinate updates with browser GPS support
- Audible warning for near-arrival critical ambulances

## Setup

1. Install dependencies with `npm install`
2. Create an `.env` file from `.env.example`
3. Set `VITE_API_BASE_URL`
4. Start with `npm run dev`

## Key API Dependencies

- `POST /auth/hospital/signup`
- `POST /auth/hospital/login`
- `GET /public/hospitals`
- `GET /hospital/me`
- `POST /hospital/update-icu`
- `POST /hospital/update-location`
- `GET /hospital/alerts`
- `PUT /alerts/{alert_id}/status`

## Production Build

- `npm run build`
- `npm run lint`
