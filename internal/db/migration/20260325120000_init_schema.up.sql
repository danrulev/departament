-- Включаем поддержку внешних ключей (обязательно при каждом подключении!)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,       -- ФИО
    password TEXT NOT NULL,
    role TEXT NOT NULL,            -- Роль: студент, преподаватель, сотрудник
    phone TEXT,                    -- Контактный телефон
    email TEXT,                    -- Email
    is_active BOOLEAN DEFAULT 1,   -- Активен ли пользователь (уволился/выпустился)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
    user_id TEXT,
    token_id TEXT,
    expired_at TIMESTAMP
);

-- Таблица ключей
CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_number TEXT UNIQUE NOT NULL, -- Уникальный номер ключа (бирка)
    room_description TEXT NOT NULL,  -- Какое помещение открывает (напр. "Лаборатория 305")
    status TEXT DEFAULT 'available', -- Статус: 'available' (свободен), 'issued' (выдан), 'lost' (утерян)
    notes TEXT                       -- Примечания (напр. "дубликат", "сломан замок")
);

-- Таблица журнала выдачи/возврата
CREATE TABLE IF NOT EXISTS key_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER NOT NULL,         -- Ссылка на ключ
    user_id TEXT NOT NULL,       -- Ссылка на пользователя
    action_type TEXT NOT NULL,       -- Тип действия: 'issue' (выдача), 'return' (возврат)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- Время события
    comment TEXT,                    -- Комментарий оператора (кто выдал, состояние ключа)
    FOREIGN KEY (key_id) REFERENCES keys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Индексы для ускорения поиска по истории
CREATE INDEX IF NOT EXISTS idx_key_logs_key_id ON key_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_key_logs_user_id ON key_logs(user_id);


CREATE TABLE IF NOT EXISTS equipment(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL NOT NULL, -- НАИМЕНОВАНИЕ
    description TEXT, -- КАК РАБОТАТЬ
    location TEXT NOT NULL, -- РАСПОЛОЖЕНИЕ
    documentation TEXT, -- ДОКУМЕНТАЦИЯ
    inventory_number TEXT UNIQUE, -- ИНВЕНТАРНЫЙ НОМЕР
    responsible_id TEXT NOT NULL, -- ОТВЕТСТВЕННЫЙ
    status BOOLEAN DEFAULT 1, -- Статус: 1 - ДОСТУПЕН, 0 - НЕ ДОСТУПЕН
    verification_date DATE, -- ДАТА ПОВЕРКИ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsible_id) REFERENCES users(id)
);

