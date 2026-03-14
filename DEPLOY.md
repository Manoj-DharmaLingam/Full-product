# Deployment Guide

Stack: **Supabase** (PostgreSQL) · **Vercel** (FastAPI backend + React frontends)

All three services deploy to Vercel as separate projects from the same GitHub repo.

---

## Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Set a name (e.g. `emergency-icu`), strong DB password, choose a region
3. Once created: **SQL Editor → New query** → paste `supabase_schema.sql` → **Run**
4. Go to **Settings → Database → Connection string → URI**
5. Copy the **Transaction pooler** string (port `6543`):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Keep this URL — you need it in Step 2

---

## Step 2 — Backend (Vercel Python Serverless)

1. Vercel → **New Project** → Import your GitHub repo
2. Set **Root Directory**: `backend`
3. **Framework**: Other
4. **Build Command**: leave blank (Vercel auto-detects Python via `vercel.json`)
5. Add these **Environment Variables**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase Transaction pooler URL from Step 1 |
| `JWT_SECRET` | Strong random string (min 32 chars) |
| `JWT_EXPIRE_MINUTES` | `1440` |
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key |
| `ALLOWED_ORIGINS` | Leave blank for now — fill in after Step 3 |
| `RESERVATION_TTL_MINUTES` | `15` |
| `AMBULANCE_AVERAGE_SPEED_KMH` | `45.0` |
| `MAX_REASONABLE_DISTANCE_KM` | `30.0` |
| `OPTIMAL_ICU_BEDS` | `3` |

6. Deploy → copy the backend URL (e.g. `https://backend-xyz.vercel.app`)

> **Generate a JWT secret:**
> ```
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

## Step 3 — Frontends (Vercel)

### Hospital App

1. Vercel → **New Project** → Import the same GitHub repo
2. **Root Directory**: `hospital-app`
3. **Framework**: Vite
4. **Environment Variable**:
   - `VITE_API_BASE_URL` = backend URL from Step 2 (e.g. `https://backend-xyz.vercel.app`)
5. Deploy → copy URL (e.g. `https://hospital-app-xyz.vercel.app`)

### Ambulance App

1. Vercel → **New Project** → Import the same GitHub repo
2. **Root Directory**: `ambulance-app`
3. **Framework**: Vite
4. **Environment Variables**:
   - `VITE_API_BASE_URL` = backend URL from Step 2
   - `VITE_GOOGLE_MAPS_API_KEY` = your Google Maps API key
5. Deploy → copy URL (e.g. `https://ambulance-app-xyz.vercel.app`)

---

## Step 4 — Update CORS on the Backend

Go back to your backend Vercel project → **Settings → Environment Variables** → set `ALLOWED_ORIGINS`:

```
https://hospital-app-xyz.vercel.app,https://ambulance-app-xyz.vercel.app
```

Then go to **Deployments** → **Redeploy** the backend.

> The backend already auto-allows all `*.vercel.app` origins via regex, so this
> step is only required for custom domains.

---

## Step 5 — Verify

| Check | URL |
|---|---|
| Backend health | `https://backend-xyz.vercel.app/health` |
| Backend API docs | `https://backend-xyz.vercel.app/docs` |
| Hospital app | `https://hospital-app-xyz.vercel.app` |
| Ambulance app | `https://ambulance-app-xyz.vercel.app` |

---

## Google Maps Key Setup

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Enable APIs**
2. Enable: **Maps JavaScript API**, **Distance Matrix API**, **Geocoding API**
3. Create an API key → restrict to your Vercel domains (`*.vercel.app`)
4. Set in backend Vercel project: `GOOGLE_MAPS_API_KEY`
5. Set in ambulance Vercel project: `VITE_GOOGLE_MAPS_API_KEY`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| CORS error in browser | Check `ALLOWED_ORIGINS` in backend env vars; redeploy backend |
| `500` on first API call | Check backend Vercel function logs — DB schema auto-creates on cold start |
| `SSL SYSCALL error` | Verify `DATABASE_URL` uses Supabase pooler (port `6543`) |
| Ambulance map blank | `VITE_GOOGLE_MAPS_API_KEY` not set in ambulance Vercel project |
| Login always fails | `JWT_SECRET` must not change after users are created |
| `Module not found` | Check Vercel function logs; re-deploy the backend project |
