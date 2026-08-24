-- Включаем поддержку внешних ключей
PRAGMA foreign_keys = ON;

-- Добавляем новые поля в таблицу users
ALTER TABLE users ADD COLUMN date_of_birth TEXT;
ALTER TABLE users ADD COLUMN office TEXT;
