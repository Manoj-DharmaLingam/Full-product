# Deployment Guide

Stack: **Supabase** (PostgreSQL) · **Render** (FastAPI backend) · **Vercel** (React frontends)

---

## Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Pick a name (e.g. `emergency-icu`), set a strong DB password, choose a region
3. Once created, open **SQL Editor → New query**, paste the contents of `supabase_schema.sql`, and click **Run**
4. Go to **Settings → Database → Connection string → URI**, copy the **Transaction pooler** string (port `6543`)
   It looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
5. Keep this URL — you need it in Step 2

---

## Step 2 — Render (Backend)

### Option A — Blueprint (recommended)

1. Push all code to GitHub (this repo)
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your GitHub repo — Render will auto-detect `render.yaml` at the repo root
4. Set these **environment variables** in the Render dashboard for the `emergency-icu-backend` service:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase connection string from Step 1 |
| `JWT_SECRET` | Run `python -c "import secrets; print(secrets.token_hex(32))"` for a random secret |
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key |
| `ALLOWED_ORIGINS` | Leave blank for now (fill in after Step 3) |

5. Deploy — wait for the build to succeed
6. Copy your Render service URL (e.g. `https://emergency-icu-backend.onrender.com`)

### Option B — Manual service

1. Render → **New → Web Service** → Connect repo
2. Set **Root Directory**: `backend`
3. **Runtime**: Python 3
4. **Build Command**: `pip install -r requirements.txt`
5. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Set the same env vars from Option A above

---

## Step 3 — Vercel (Frontends)

Deploy **both** frontend apps as separate Vercel projects.

### Hospital App

1. Vercel → **New Project** → Import your GitHub repo
2. Set **Root Directory**: `hospital-app`
3. **Framework**: Vite
4. Add **Environment Variable**:
   - `VITE_API_BASE_URL` = your Render URL (e.g. `https://emergency-icu-backend.onrender.com`)
5. Deploy — copy the production URL (e.g. `https://hospital-app-xyz.vercel.app`)

### Ambulance App

1. Vercel → **New Project** → Import your GitHub repo
2. Set **Root Directory**: `ambulance-app`
3. **Framework**: Vite
4. Add **Environment Variables**:
   - `VITE_API_BASE_URL` = your Render URL
   - `VITE_GOOGLE_MAPS_API_KEY` = your Google Maps API key
5. Deploy — copy the production URL (e.g. `https://ambulance-app-xyz.vercel.app`)

---

## Step 4 — Update CORS on Render

Go back to Render → your backend service → **Environment** → update `ALLOWED_ORIGINS`:

```
https://hospital-app-xyz.vercel.app,https://ambulance-app-xyz.vercel.app
```

Click **Save** — Render will redeploy automatically.

> Note: The backend already has a regex that auto-allows all `*.vercel.app` domains,
> so this step is only needed for custom domains.

---

## Step 5 — Verify

| Check | URL |
|---|---|
| Backend health | `https://your-render-url.onrender.com/health` |
| Backend docs | `https://your-render-url.onrender.com/docs` |
| Hospital app | `https://your-hospital-app.vercel.app` |
| Ambulance app | `https://your-ambulance-app.vercel.app` |

---

## Google Maps Key Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs: **Maps JavaScript API**, **Distance Matrix API**, **Geocoding API**
3. Create an API key → restrict it to your Vercel domains (`*.vercel.app`)
4. Set the key in both Render (`GOOGLE_MAPS_API_KEY`) and Vercel ambulance app (`VITE_GOOGLE_MAPS_API_KEY`)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| CORS error in browser | Ensure `ALLOWED_ORIGINS` on Render includes both Vercel URLs |
| Database connection error | Verify `DATABASE_URL` is the Supabase Transaction pooler URL (port 6543) |
| 500 on first request | Check Render logs — the DB schema auto-creates on first startup |
| Ambulance map not loading | Check `VITE_GOOGLE_MAPS_API_KEY` is set in Vercel ambulance app env vars |
| Login fails after deploy | `JWT_SECRET` must be consistent — do not change it after users are created |
