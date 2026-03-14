# Emergency ICU Routing Backend

FastAPI backend for the Smart ICU Management platform. It manages hospital and ambulance accounts, ICU bed state, hospital recommendations, and pre-arrival alert workflows.

## Setup

1. Create a PostgreSQL database such as `emergency_icu`
2. Copy `.env.example` to `.env`
3. Install dependencies with `pip install -r requirements.txt`
4. Run the API with `uvicorn main:app --reload --port 8000`

Tables are created automatically on startup from the SQLAlchemy models.

## Core Endpoints

- `POST /auth/hospital/signup`
- `POST /auth/hospital/login`
- `POST /auth/ambulance/signup`
- `POST /auth/ambulance/login`
- `GET /public/hospitals`
- `GET /hospital/me`
- `POST /hospital/update-icu`
- `POST /hospital/update-location`
- `GET /hospital/alerts`
- `GET /ambulance/me`
- `POST /ambulance/update-location`
- `POST /ambulance/request`
- `GET /ambulance/recommend-hospital`
- `POST /ambulance/book-icu`
- `POST /alerts`
- `PUT /alerts/{alert_id}/status`
