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
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_applications_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_applications_user_event
        UNIQUE (user_id, event_id)
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

-- =========================================
-- БАЗОВЫЕ ДАННЫЕ
-- =========================================
INSERT INTO categories (name) VALUES
('Экология'),
('Детям'),
('Животным'),
('Пожилым');

INSERT INTO users (email, password, role, is_active)
VALUES
('admin@example.com', 'admin_password', 'admin', TRUE),
('coordinator@example.com', 'coord_password', 'coordinator', TRUE),
('volunteer@example.com', 'vol_password', 'volunteer', TRUE);

INSERT INTO profiles (
    user_id, first_name, last_name, phone, city, avatar_url, bio, social_vk, social_ok, social_max
)
SELECT
    id,
    'Алексей',
    'Админов',
    '+79990000001',
    'Москва',
    NULL,
    'Администратор системы',
    'vk.com/admin',
    'ok.ru/admin',
    'max.ru/admin'
FROM users
WHERE email = 'admin@example.com';

INSERT INTO profiles (
    user_id, first_name, last_name, phone, city, avatar_url, bio, social_vk, social_ok, social_max
)
SELECT
    id,
    'Мария',
    'Координаторова',
    '+79990000002',
    'Казань',
    NULL,
    'Координатор мероприятий',
    'vk.com/coord',
    'ok.ru/coord',
    'max.ru/coord'
FROM users
WHERE email = 'coordinator@example.com';

INSERT INTO profiles (
    user_id, first_name, last_name, phone, city, avatar_url, bio, social_vk, social_ok, social_max
)
SELECT
    id,
    'Иван',
    'Волонтёров',
    '+79990000003',
    'Казань',
    NULL,
    'Люблю участвовать в социальных проектах',
    'vk.com/volunteer',
    'ok.ru/volunteer',
    'max.ru/volunteer'
FROM users
WHERE email = 'volunteer@example.com';

INSERT INTO events (
    title,
    description,
    start_at,
    location,
    tasks,
    participant_limit,
    available_slots,
    category_id,
    created_by
)
VALUES (
    'Экологическая акция в городском парке',
    'Уборка территории парка и помощь в сортировке отходов.',
    '2026-05-15 10:00:00',
    'Центральный парк, Казань',
    ARRAY[
        'Сбор пластиковых отходов',
        'Уборка листвы',
        'Сортировка мусора'
    ],
    20,
    20,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
);

INSERT INTO events (
    id,
    title,
    description,
    start_at,
    location,
    tasks,
    participant_limit,
    available_slots,
    category_id,
    created_by
)
VALUES

-- ЭКОЛОГИЯ
(
    gen_random_uuid(),
    'Уборка городского парка',
    'Очистка территории от мусора.',
    '2026-06-01 10:00:00',
    'Парк Горького, Москва',
    ARRAY['Сбор мусора', 'Сортировка отходов'],
    20, 20,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Посадка деревьев',
    'Озеленение района.',
    '2026-06-02 10:00:00',
    'Парк Победы',
    ARRAY['Посадка деревьев', 'Полив'],
    25, 25,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Сбор макулатуры',
    'Экологическая акция.',
    '2026-06-03 10:00:00',
    'Школа №12',
    ARRAY['Сбор бумаги', 'Сортировка'],
    12, 12,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Очистка берега реки',
    'Сбор мусора вдоль реки.',
    '2026-06-04 10:00:00',
    'Берег Волги',
    ARRAY['Сбор мусора', 'Вывоз отходов'],
    18, 18,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Субботник во дворе',
    'Уборка придомовой территории.',
    '2026-06-05 10:00:00',
    'Жилой двор',
    ARRAY['Уборка', 'Вывоз мусора'],
    15, 15,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- ДЕТЯМ
(
    gen_random_uuid(),
    'Игры с детьми в центре',
    'Развлекательная программа.',
    '2026-06-06 12:00:00',
    'Центр "Надежда"',
    ARRAY['Игры', 'Рисование'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Мастер-класс для детей',
    'Творческое занятие.',
    '2026-06-07 12:00:00',
    'Дом культуры',
    ARRAY['Подготовка материалов', 'Проведение занятия'],
    12, 12,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Чтение книг детям',
    'Образовательное мероприятие.',
    '2026-06-08 11:00:00',
    'Библиотека',
    ARRAY['Чтение', 'Обсуждение'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь детям с уроками',
    'Образовательная поддержка.',
    '2026-06-09 12:00:00',
    'Центр помощи',
    ARRAY['Помощь с ДЗ', 'Объяснение'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Игровая программа в детском доме',
    'Организация досуга детей.',
    '2026-06-10 11:00:00',
    'Детский дом',
    ARRAY['Игры', 'Общение'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- ЖИВОТНЫМ
(
    gen_random_uuid(),
    'Помощь в приюте для животных',
    'Уход за животными.',
    '2026-06-11 11:00:00',
    'Приют "Лапки"',
    ARRAY['Кормление', 'Уборка вольеров'],
    15, 15,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Выгуливание собак',
    'Помощь приюту.',
    '2026-06-12 09:00:00',
    'Приют "Хвостики"',
    ARRAY['Выгуливание', 'Кормление'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Уход за кошками',
    'Помощь приюту.',
    '2026-06-13 09:00:00',
    'Приют для кошек',
    ARRAY['Кормление', 'Уборка'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Уборка вольеров',
    'Очистка помещений для животных.',
    '2026-06-14 10:00:00',
    'Приют',
    ARRAY['Уборка', 'Дезинфекция'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь ветеринару',
    'Ассистирование врачу.',
    '2026-06-15 10:00:00',
    'Ветклиника',
    ARRAY['Подготовка инструментов', 'Помощь врачу'],
    6, 6,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- ПОЖИЛЫМ
(
    gen_random_uuid(),
    'Помощь пожилым по дому',
    'Уборка и помощь.',
    '2026-06-16 09:00:00',
    'Дом престарелых',
    ARRAY['Уборка', 'Общение'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Покупка продуктов пенсионерам',
    'Социальная помощь.',
    '2026-06-17 09:00:00',
    'Город',
    ARRAY['Покупка продуктов', 'Доставка'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Сопровождение на прогулке',
    'Помощь пожилым людям.',
    '2026-06-18 10:00:00',
    'Парк',
    ARRAY['Сопровождение', 'Общение'],
    6, 6,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Обучение работе со смартфоном',
    'Цифровая помощь.',
    '2026-06-19 11:00:00',
    'Центр',
    ARRAY['Обучение', 'Консультации'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Доставка лекарств',
    'Помощь пожилым.',
    '2026-06-20 09:00:00',
    'Город',
    ARRAY['Покупка лекарств', 'Доставка'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
);

INSERT INTO applications (
    user_id,
    event_id,
    status
)
VALUES (
    (SELECT id FROM users WHERE email = 'volunteer@example.com'),
    (SELECT id FROM events WHERE title = 'Экологическая акция в городском парке'),
    'active'
);

-- =========================================
-- ДОПОЛНИТЕЛЬНЫЕ МЕРОПРИЯТИЯ
-- =========================================

INSERT INTO events (
    id,
    title,
    description,
    start_at,
    location,
    tasks,
    participant_limit,
    available_slots,
    category_id,
    created_by
)
VALUES

-- Экология
(
    gen_random_uuid(),
    'Посадка кустарников в сквере',
    'Озеленение общественного пространства.',
    '2026-06-21 10:00:00',
    'Городской сквер',
    ARRAY['Подготовка почвы', 'Посадка кустарников', 'Полив'],
    16, 16,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Сбор пластика на набережной',
    'Очистка прогулочной зоны от отходов.',
    '2026-06-22 09:30:00',
    'Набережная',
    ARRAY['Сбор пластика', 'Сортировка мусора'],
    14, 14,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Уборка территории у озера',
    'Экологическая акция по очистке территории.',
    '2026-06-23 10:00:00',
    'Озеро Лесное',
    ARRAY['Сбор мусора', 'Очистка берега', 'Вывоз мешков'],
    20, 20,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Высадка цветов у школы',
    'Благоустройство школьной территории.',
    '2026-06-24 11:00:00',
    'Школа №7',
    ARRAY['Подготовка клумб', 'Высадка цветов', 'Полив'],
    12, 12,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Эко-субботник в лесопарке',
    'Уборка природной зоны.',
    '2026-06-25 10:00:00',
    'Лесопарк',
    ARRAY['Сбор мусора', 'Сортировка', 'Погрузка отходов'],
    24, 24,
    (SELECT id FROM categories WHERE name = 'Экология'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- Детям
(
    gen_random_uuid(),
    'Творческий мастер-класс для детей',
    'Проведение занятия по рисованию и поделкам.',
    '2026-06-26 12:00:00',
    'Центр детского творчества',
    ARRAY['Подготовка материалов', 'Проведение занятия', 'Помощь детям'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Спортивный день в детском центре',
    'Организация активных игр и эстафет.',
    '2026-06-27 11:00:00',
    'Детский центр',
    ARRAY['Подготовка инвентаря', 'Проведение игр', 'Поддержка детей'],
    14, 14,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Час настольных игр для детей',
    'Организация развивающего досуга.',
    '2026-06-28 13:00:00',
    'Библиотека',
    ARRAY['Подготовка игр', 'Объяснение правил', 'Сопровождение детей'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь в проведении детского праздника',
    'Участие в организации праздничной программы.',
    '2026-06-29 12:00:00',
    'Дом культуры',
    ARRAY['Украшение зала', 'Помощь ведущему', 'Сопровождение детей'],
    12, 12,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Занятие по чтению для младших школьников',
    'Помощь детям в развитии навыков чтения.',
    '2026-06-30 10:30:00',
    'Образовательный центр',
    ARRAY['Чтение вслух', 'Помощь с упражнениями', 'Поддержка детей'],
    9, 9,
    (SELECT id FROM categories WHERE name = 'Детям'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- Животным
(
    gen_random_uuid(),
    'Кормление животных в приюте',
    'Помощь персоналу приюта.',
    '2026-07-01 09:00:00',
    'Приют "Верный друг"',
    ARRAY['Подготовка корма', 'Кормление животных', 'Уборка мисок'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь в уходе за щенками',
    'Забота о животных в приюте.',
    '2026-07-02 10:00:00',
    'Приют для собак',
    ARRAY['Кормление', 'Уборка зоны', 'Игры со щенками'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Уборка территории приюта',
    'Благоустройство территории для животных.',
    '2026-07-03 09:30:00',
    'Приют "Лапа помощи"',
    ARRAY['Уборка территории', 'Сбор мусора', 'Дезинфекция'],
    12, 12,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Социализация собак',
    'Помощь животным адаптироваться к общению.',
    '2026-07-04 10:00:00',
    'Кинологический центр',
    ARRAY['Прогулка', 'Игры', 'Наблюдение за поведением'],
    6, 6,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь в перевозке кормов для приюта',
    'Организация доставки необходимых материалов.',
    '2026-07-05 11:00:00',
    'Склад приюта',
    ARRAY['Погрузка кормов', 'Перенос коробок', 'Разгрузка'],
    10, 10,
    (SELECT id FROM categories WHERE name = 'Животным'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),

-- Пожилым
(
    gen_random_uuid(),
    'Уборка квартиры пожилого человека',
    'Бытовая помощь пожилым людям.',
    '2026-07-06 09:00:00',
    'Городской район',
    ARRAY['Сухая уборка', 'Влажная уборка', 'Помощь по дому'],
    6, 6,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Сопровождение в поликлинику',
    'Помощь пожилым людям в посещении врача.',
    '2026-07-07 08:30:00',
    'Поликлиника №3',
    ARRAY['Встреча', 'Сопровождение', 'Помощь с документами'],
    5, 5,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь с покупкой бытовых товаров',
    'Социальная поддержка пожилых людей.',
    '2026-07-08 10:00:00',
    'Город',
    ARRAY['Покупка товаров', 'Доставка', 'Передача покупок'],
    7, 7,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Общение и чтение книг пожилым',
    'Организация досуга и поддержки.',
    '2026-07-09 11:00:00',
    'Дом престарелых',
    ARRAY['Чтение книг', 'Беседа', 'Поддержка общения'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
),
(
    gen_random_uuid(),
    'Помощь в освоении электронных услуг',
    'Обучение пожилых людей базовым цифровым навыкам.',
    '2026-07-10 12:00:00',
    'Социальный центр',
    ARRAY['Объяснение интерфейса', 'Помощь с телефоном', 'Ответы на вопросы'],
    8, 8,
    (SELECT id FROM categories WHERE name = 'Пожилым'),
    (SELECT id FROM users WHERE email = 'coordinator@example.com')
);

-- =========================================
-- ПРОВЕРКА
-- =========================================
SELECT * FROM users;
SELECT * FROM profiles;
SELECT * FROM categories;
SELECT * FROM events;
SELECT * FROM applications;
