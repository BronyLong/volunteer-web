-- =========================================
-- БД для веб-приложения волонтёрской организации
-- PostgreSQL
-- =========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS auth_email_tokens CASCADE;
DROP TABLE IF EXISTS notification_category_settings CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
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
    email_hash TEXT UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    personal_data_consent BOOLEAN NOT NULL DEFAULT FALSE,
    personal_data_consent_at TIMESTAMP,
    personal_data_consent_version VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 2. PROFILES
-- =========================================
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    gender VARCHAR(20) NOT NULL DEFAULT 'male',
    phone VARCHAR(30),
    city VARCHAR(120),
    avatar_url TEXT,
    bio TEXT,
    social_vk TEXT,
    social_ok TEXT,
    social_max TEXT,
    CONSTRAINT chk_profiles_gender
        CHECK (gender IN ('male', 'female')),

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
    location_latitude NUMERIC(10, 7),
    location_longitude NUMERIC(10, 7),
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
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
        CHECK (available_slots <= participant_limit),

    CONSTRAINT chk_events_location_latitude
        CHECK (location_latitude IS NULL OR (location_latitude >= -90 AND location_latitude <= 90)),

    CONSTRAINT chk_events_location_longitude
        CHECK (location_longitude IS NULL OR (location_longitude >= -180 AND location_longitude <= 180)),

    CONSTRAINT chk_events_location_coordinates_pair
        CHECK (
            (location_latitude IS NULL AND location_longitude IS NULL)
            OR
            (location_latitude IS NOT NULL AND location_longitude IS NOT NULL)
        )
);

-- =========================================
-- 5. APPLICATIONS
-- =========================================
CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    participation_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    participation_confirmed_at TIMESTAMP,
    participation_confirmed_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_applications_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_applications_confirmed_by
        FOREIGN KEY (participation_confirmed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_applications_status
        CHECK (status IN ('pending', 'approved', 'rejected'))
);


-- =========================================
-- 6. NOTIFICATION_SETTINGS
-- =========================================
CREATE TABLE notification_settings (
    user_id UUID PRIMARY KEY,
    receive_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_events BOOLEAN NOT NULL DEFAULT TRUE,
    notify_coordinator_messages BOOLEAN NOT NULL DEFAULT TRUE,
    notify_application_status BOOLEAN NOT NULL DEFAULT TRUE,
    notify_event_assignment BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_applications BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- 7. NOTIFICATION_CATEGORY_SETTINGS
-- =========================================
CREATE TABLE notification_category_settings (
    user_id UUID NOT NULL,
    category_id INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_notification_category_settings
        PRIMARY KEY (user_id, category_id),

    CONSTRAINT fk_notification_category_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_category_settings_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE CASCADE
);

-- =========================================
-- 8. AUTH_EMAIL_TOKENS
-- =========================================
CREATE TABLE auth_email_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    purpose VARCHAR(40) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_email_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_auth_email_tokens_purpose
        CHECK (purpose IN ('registration_confirmation', 'password_reset'))
);

-- =========================================
-- 9. NOTIFICATIONS
-- =========================================
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    event_id UUID,
    application_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_application
        FOREIGN KEY (application_id)
        REFERENCES applications(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_notifications_type
        CHECK (type IN (
            'new_event',
            'coordinator_event_invite',
            'application_status',
            'new_application',
            'event_assignment',
            'urgent_event'
        ))
);

-- =========================================
-- 10. AUDIT_LOGS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash
    ON users(email_hash)
    WHERE email_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name
    ON categories(name);

CREATE INDEX IF NOT EXISTS idx_events_start_at
    ON events(start_at);

CREATE INDEX IF NOT EXISTS idx_events_category_id
    ON events(category_id);

CREATE INDEX IF NOT EXISTS idx_events_is_urgent
    ON events(is_urgent);

CREATE INDEX IF NOT EXISTS idx_applications_event_id
    ON applications(event_id);

CREATE INDEX IF NOT EXISTS idx_applications_user_id
    ON applications(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications(status);

CREATE INDEX IF NOT EXISTS idx_applications_participation_confirmed
    ON applications(participation_confirmed);

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_event_active
    ON applications(user_id, event_id)
    WHERE status IN ('pending', 'approved');


CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id
    ON notification_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_category_settings_category_id
    ON notification_category_settings(category_id);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_user_id
    ON auth_email_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_token_hash
    ON auth_email_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_purpose
    ON auth_email_tokens(purpose);

CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_expires_at
    ON auth_email_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications(created_at DESC);

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

CREATE TRIGGER trg_notification_settings_set_updated_at
BEFORE UPDATE ON notification_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notification_category_settings_set_updated_at
BEFORE UPDATE ON notification_category_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
