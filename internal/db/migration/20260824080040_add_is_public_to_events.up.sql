-- Добавляем поле is_public в таблицу events
ALTER TABLE events ADD COLUMN is_public BOOLEAN DEFAULT 1;

-- Индекс для фильтрации по публичности
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public);
