-- urfu4tour BETA 2.8
-- Группировка экземпляров регулярного маршрута в одну папку в интерфейсе.
SET @db = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name='future_trips' AND column_name='repeat_group')=0,
  'ALTER TABLE future_trips ADD COLUMN repeat_group VARCHAR(80) NULL AFTER status, ADD INDEX idx_future_repeat_group (repeat_group)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
