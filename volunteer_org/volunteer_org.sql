-- =========================================
-- БД для веб-приложения волонтёрской организации
-- PostgreSQL
-- =========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- =========================================
-- 1. USERS
-- =========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 2. PROFILES
-- =========================================
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    city VARCHAR(120),
    avatar_url TEXT,
    bio TEXT,
    social_vk TEXT,
    social_ok TEXT,
    social_max TEXT,
    CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- 3. CATEGORIES
-- =========================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- =========================================
-- 4. EVENTS
-- =========================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    image_url TEXT,
    description TEXT NOT NULL,
    start_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 120,
    location VARCHAR(255) NOT NULL,
    tasks TEXT[] NOT NULL DEFAULT '{}',
    participant_limit INTEGER NOT NULL,
    available_slots INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_events_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_events_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_events_duration_minutes
        CHECK (duration_minutes > 0),

    CONSTRAINT chk_events_participant_limit
        CHECK (participant_limit > 0),

    CONSTRAINT chk_events_available_slots_min
        CHECK (available_slots >= 0),

    CONSTRAINT chk_events_available_slots_max
        CHECK (available_slots <= participant_limit)
);

-- =========================================
-- 5. APPLICATIONS
-- =========================================
CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_applications_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_applications_status
        CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- =========================================
-- 6. AUDIT_LOGS
-- =========================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NULL,
    user_role VARCHAR(32),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id TEXT NULL,
    method VARCHAR(10),
    route TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- =========================================
-- ИНДЕКСЫ
-- =========================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name
    ON categories(name);

CREATE INDEX IF NOT EXISTS idx_events_start_at
    ON events(start_at);

CREATE INDEX IF NOT EXISTS idx_events_category_id
    ON events(category_id);

CREATE INDEX IF NOT EXISTS idx_applications_event_id
    ON applications(event_id);

CREATE INDEX IF NOT EXISTS idx_applications_user_id
    ON applications(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_event_active
    ON applications(user_id, event_id)
    WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
    ON audit_logs(entity_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at DESC);

-- =========================================
-- ТРИГГЕР НА updated_at
-- =========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
