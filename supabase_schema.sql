-- =============================================================================
-- Emergency ICU Routing Platform — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- users
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    role        VARCHAR(20)  NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- hospitals
CREATE TABLE IF NOT EXISTS hospitals (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    hospital_name       VARCHAR(255) NOT NULL UNIQUE,
    contact_number      VARCHAR(32)  NOT NULL,
    hospital_address    TEXT         NOT NULL,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    specialties         TEXT         NOT NULL DEFAULT '',
    total_icu_beds      INTEGER      NOT NULL DEFAULT 0,
    available_icu_beds  INTEGER      NOT NULL DEFAULT 0,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ambulances
CREATE TABLE IF NOT EXISTS ambulances (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ambulance_id                VARCHAR(64)  NOT NULL UNIQUE,
    driver_name                 VARCHAR(255) NOT NULL,
    driver_phone                VARCHAR(32)  NOT NULL,
    ambulance_registration_number VARCHAR(64) NOT NULL UNIQUE,
    latitude                    DOUBLE PRECISION,
    longitude                   DOUBLE PRECISION,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ambulance_requests
CREATE TABLE IF NOT EXISTS ambulance_requests (
    id                      SERIAL PRIMARY KEY,
    ambulance_id            INTEGER NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    blood_group             VARCHAR(8)  NOT NULL,
    oxygen_level            DOUBLE PRECISION NOT NULL,
    patient_condition_notes TEXT,
    severity                VARCHAR(16) NOT NULL,
    required_specialty      VARCHAR(100),
    timestamp               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
    id                      SERIAL PRIMARY KEY,
    hospital_id             INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ambulance_request_id    INTEGER NOT NULL REFERENCES ambulance_requests(id) ON DELETE CASCADE,
    status                  VARCHAR(32)  NOT NULL DEFAULT 'reserved',
    eta                     DOUBLE PRECISION,
    reserved_until          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- doctors
CREATE TABLE IF NOT EXISTS doctors (
    id                SERIAL PRIMARY KEY,
    hospital_id       INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    specialty         VARCHAR(255) NOT NULL,
    qualification     TEXT,
    experience_years  INTEGER      NOT NULL DEFAULT 0,
    availability      VARCHAR(255),
    is_available      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
